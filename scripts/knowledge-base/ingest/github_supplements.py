"""Supplementary GitHub ingestion for content the Elastic connector cannot extract.

The Elastic GitHub connector handles markdown docs, issues, and PRs. This script
fills the gaps by fetching:
- YAML configuration files (.yaml, .yml)
- GitHub Releases with changelogs
- Code examples (.py, .java, .js, .go)

Usage:
    python -m ingest.github_supplements --repo elastic/opentelemetry
"""

import logging
import os
import time
from base64 import b64decode
from datetime import datetime, timezone
from typing import Optional

import requests
import yaml
from rich.console import Console

from ingest.base import BaseIngestor, IngestResult

console = Console()
logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"

# File extensions to extract for each content type
YAML_EXTENSIONS = {".yaml", ".yml"}
CODE_EXTENSIONS = {".py", ".java", ".js", ".ts", ".go", ".cs"}

# Max file size to ingest (100KB)
MAX_FILE_SIZE = 100_000


class GitHubSupplementIngestor(BaseIngestor):
    """Ingest content types that the Elastic GitHub connector does not extract."""

    def __init__(
        self,
        es_client,
        index_name: str,
        source_tier: str,
        github_token: Optional[str] = None,
        **kwargs,
    ) -> None:
        super().__init__(es_client, index_name, source_tier, **kwargs)
        self.github_token = github_token or os.environ.get("GITHUB_TOKEN", "")
        self._request_count = 0

    def _github_headers(self) -> dict:
        """Build GitHub API request headers."""
        headers = {"Accept": "application/vnd.github.v3+json"}
        if self.github_token:
            headers["Authorization"] = f"token {self.github_token}"
        return headers

    def _github_get(self, endpoint: str, params: Optional[dict] = None) -> Optional[dict]:
        """Make a GitHub API GET request with rate limit awareness."""
        url = f"{GITHUB_API}{endpoint}" if endpoint.startswith("/") else endpoint
        try:
            response = self.retry_with_backoff(
                lambda: requests.get(
                    url, headers=self._github_headers(), params=params, timeout=30
                ),
                max_retries=3,
                base_delay=2.0,
            )
            self._request_count += 1

            # Check rate limits
            remaining = int(response.headers.get("X-RateLimit-Remaining", 999))
            if remaining < 100:
                reset_time = int(response.headers.get("X-RateLimit-Reset", 0))
                wait = max(0, reset_time - time.time()) + 1
                logger.warning(
                    "GitHub API rate limit low (%d remaining). Waiting %.0fs.",
                    remaining, wait,
                )
                time.sleep(min(wait, 60))

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                return None
            else:
                logger.error("GitHub API error %d for %s", response.status_code, url)
                return None
        except Exception as e:
            logger.error("GitHub API request failed for %s: %s", url, e)
            return None

    def _github_get_raw(self, endpoint: str) -> Optional[str]:
        """Fetch raw file content from GitHub API."""
        url = f"{GITHUB_API}{endpoint}" if endpoint.startswith("/") else endpoint
        headers = self._github_headers()
        headers["Accept"] = "application/vnd.github.raw"
        try:
            response = requests.get(url, headers=headers, timeout=30)
            self._request_count += 1
            if response.status_code == 200:
                return response.text
            return None
        except Exception as e:
            logger.error("GitHub raw content fetch failed for %s: %s", url, e)
            return None

    def fetch_releases(
        self, repo: str, limit: int = 5
    ) -> list[dict]:
        """Fetch recent GitHub Releases with full changelogs."""
        console.print(f"    Fetching releases for {repo}...")
        releases_data = self._github_get(
            f"/repos/{repo}/releases", params={"per_page": limit}
        )
        if not releases_data:
            return []

        docs = []
        for release in releases_data:
            tag = release.get("tag_name", "")
            name = release.get("name", tag)
            body = release.get("body", "")
            published = release.get("published_at", "")

            if not body:
                continue

            doc = self.prepare_document(
                title=f"{repo} Release {name}",
                body=f"# {name}\n\nTag: {tag}\nPublished: {published}\n\n{body}",
                url=release.get("html_url", f"https://github.com/{repo}/releases/tag/{tag}"),
                content_type="release",
                tags=["release", "changelog"],
                extra_fields={
                    "repo": repo,
                    "release_tag": tag,
                    "source_type": "github",
                    "last_modified": published,
                },
            )
            docs.append(doc)

        console.print(f"      Found {len(docs)} releases")
        return docs

    def fetch_yaml_configs(
        self,
        repo: str,
        directories: Optional[list[str]] = None,
    ) -> list[dict]:
        """Fetch YAML/YML files from specified directories."""
        if directories is None:
            directories = ["docs", "examples", "config", "demo"]

        console.print(f"    Fetching YAML configs from {repo}...")
        docs = []

        for directory in directories:
            tree = self._github_get(
                f"/repos/{repo}/git/trees/main",
                params={"recursive": "1"},
            )
            if not tree or "tree" not in tree:
                # Try 'master' branch
                tree = self._github_get(
                    f"/repos/{repo}/git/trees/master",
                    params={"recursive": "1"},
                )
            if not tree or "tree" not in tree:
                continue

            for item in tree["tree"]:
                path = item.get("path", "")
                if not path.startswith(directory + "/"):
                    continue
                if item.get("type") != "blob":
                    continue

                # Check file extension
                ext = os.path.splitext(path)[1].lower()
                if ext not in YAML_EXTENSIONS:
                    continue

                # Check file size
                size = item.get("size", 0)
                if size > MAX_FILE_SIZE:
                    continue

                # Fetch raw content
                content = self._github_get_raw(f"/repos/{repo}/contents/{path}")
                if not content:
                    continue

                doc = self.prepare_document(
                    title=f"{repo}/{path}",
                    body=f"# {path}\n\nRepository: {repo}\n\n```yaml\n{content}\n```",
                    url=f"https://github.com/{repo}/blob/main/{path}",
                    content_type="yaml_config",
                    tags=["yaml", "config", "example"],
                    extra_fields={
                        "repo": repo,
                        "file_path": path,
                        "source_type": "github",
                    },
                )
                docs.append(doc)

        console.print(f"      Found {len(docs)} YAML files")
        return docs

    def fetch_code_examples(
        self,
        repo: str,
        directories: Optional[list[str]] = None,
        language_sdk: Optional[str] = None,
    ) -> list[dict]:
        """Fetch code examples from specified directories."""
        if directories is None:
            directories = ["examples"]

        console.print(f"    Fetching code examples from {repo}...")
        docs = []

        tree = self._github_get(
            f"/repos/{repo}/git/trees/main",
            params={"recursive": "1"},
        )
        if not tree or "tree" not in tree:
            tree = self._github_get(
                f"/repos/{repo}/git/trees/master",
                params={"recursive": "1"},
            )
        if not tree or "tree" not in tree:
            return docs

        for item in tree["tree"]:
            path = item.get("path", "")
            in_target_dir = any(path.startswith(d + "/") for d in directories)
            if not in_target_dir:
                continue
            if item.get("type") != "blob":
                continue

            ext = os.path.splitext(path)[1].lower()
            if ext not in CODE_EXTENSIONS:
                continue

            size = item.get("size", 0)
            if size > MAX_FILE_SIZE:
                continue

            content = self._github_get_raw(f"/repos/{repo}/contents/{path}")
            if not content:
                continue

            # Detect language from extension
            lang_map = {
                ".py": "python", ".java": "java", ".js": "javascript",
                ".ts": "typescript", ".go": "go", ".cs": "csharp",
            }
            lang = lang_map.get(ext, "text")

            doc = self.prepare_document(
                title=f"{repo}/{path}",
                body=f"# {path}\n\nRepository: {repo}\n\n```{lang}\n{content}\n```",
                url=f"https://github.com/{repo}/blob/main/{path}",
                content_type="code_example",
                language_sdk=language_sdk,
                tags=["code", "example", lang],
                extra_fields={
                    "repo": repo,
                    "file_path": path,
                    "source_type": "github",
                },
            )
            docs.append(doc)

        console.print(f"      Found {len(docs)} code examples")
        return docs

    def ingest_repo(
        self,
        repo_config: dict,
        force: bool = False,
    ) -> IngestResult:
        """Ingest supplementary content from a single repository."""
        repo = repo_config["repo"]
        name = repo_config.get("name", repo)
        result = IngestResult(source_name=name)
        start_time = time.time()

        console.print(f"\n  [bold]{name}[/bold] ({repo})")

        supplement_dirs = repo_config.get("supplement_dirs", ["docs", "examples", "config"])
        language_sdk = repo_config.get("language_sdk")

        all_docs = []

        # Fetch releases
        release_docs = self.fetch_releases(repo)
        all_docs.extend(release_docs)

        # Fetch YAML configs
        yaml_docs = self.fetch_yaml_configs(repo, supplement_dirs)
        all_docs.extend(yaml_docs)

        # Fetch code examples
        code_docs = self.fetch_code_examples(repo, supplement_dirs, language_sdk)
        all_docs.extend(code_docs)

        result.total_fetched = len(all_docs)

        # Filter out unchanged content
        if not force:
            new_docs = []
            for doc in all_docs:
                if self.should_reingest(doc["url"], doc["body"]):
                    new_docs.append(doc)
                else:
                    result.skipped += 1
            all_docs = new_docs

        # Bulk index
        if all_docs:
            indexed, errors = self.bulk_index(all_docs)
            result.indexed = indexed
            result.errors = errors
        else:
            console.print("    [dim]No new supplementary content to index.[/dim]")

        result.elapsed_seconds = time.time() - start_time
        console.print(f"    {result}")
        console.print(f"    [dim]GitHub API requests used: {self._request_count}[/dim]")
        return result
