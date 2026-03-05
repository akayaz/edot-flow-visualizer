"""Jina Reader ingestion pipeline for web documentation.

Fetches web content (docs, blogs, community pages) via the Jina Reader API,
which converts HTML to clean Markdown suitable for embedding and semantic search.

Handles Tiers 1, 3 (web), 4, and 5 sources from sources.yaml.

Usage:
    python -m ingest.jina_reader --tier 1
"""

import logging
import os
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import requests
import yaml
from rich.console import Console

from ingest.base import BaseIngestor, IngestResult

console = Console()
logger = logging.getLogger(__name__)

JINA_READER_BASE = "https://r.jina.ai/"
JINA_SEARCH_BASE = "https://s.jina.ai/"

# Default rate limit: 1 request per second (free tier)
DEFAULT_RATE_LIMIT = 1.0


class JinaReaderIngestor(BaseIngestor):
    """Ingest web documentation via Jina Reader API."""

    def __init__(
        self,
        es_client,
        index_name: str,
        source_tier: str,
        jina_api_key: Optional[str] = None,
        rate_limit: float = DEFAULT_RATE_LIMIT,
        **kwargs,
    ) -> None:
        super().__init__(es_client, index_name, source_tier, **kwargs)
        self.jina_api_key = jina_api_key or os.environ.get("JINA_API_KEY", "")
        self.rate_limit = rate_limit
        self._last_request_time = 0.0

    def _rate_limit_wait(self) -> None:
        """Enforce rate limiting between Jina API requests."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.rate_limit:
            time.sleep(self.rate_limit - elapsed)
        self._last_request_time = time.time()

    def _jina_headers(
        self,
        content_selector: Optional[str] = None,
        remove_selector: Optional[str] = None,
    ) -> dict:
        """Build Jina Reader API request headers."""
        headers = {
            "X-Return-Format": "markdown",
        }
        if self.jina_api_key:
            headers["Authorization"] = f"Bearer {self.jina_api_key}"
        if content_selector:
            headers["X-Target-Selector"] = content_selector
        if remove_selector:
            headers["X-Remove-Selector"] = remove_selector
        return headers

    def fetch_page(
        self,
        url: str,
        content_selector: Optional[str] = None,
        remove_selector: Optional[str] = None,
    ) -> Optional[dict]:
        """Fetch a single page via Jina Reader.

        Returns dict with 'title', 'content', 'url' or None on failure.
        """
        self._rate_limit_wait()
        headers = self._jina_headers(content_selector, remove_selector)

        def _do_fetch():
            response = requests.get(
                f"{JINA_READER_BASE}{url}",
                headers=headers,
                timeout=90,
            )
            response.raise_for_status()
            return response

        try:
            response = self.retry_with_backoff(
                _do_fetch, max_retries=3, base_delay=2.0
            )
            content = response.text.strip()
            if not content:
                logger.warning("Empty content from Jina Reader for %s", url)
                return None

            # Extract title from first markdown heading if present
            title = url
            lines = content.split("\n")
            for line in lines:
                if line.startswith("# "):
                    title = line[2:].strip()
                    break

            return {
                "title": title,
                "content": content,
                "url": url,
            }
        except Exception as e:
            logger.error("Failed to fetch %s via Jina Reader: %s", url, e)
            return None

    def fetch_sitemap(
        self,
        sitemap_url: str,
        path_filter: Optional[str] = None,
    ) -> list[str]:
        """Parse XML sitemap to discover all page URLs.

        Optionally filters URLs by a path prefix.
        """
        try:
            response = requests.get(sitemap_url, timeout=30)
            response.raise_for_status()
        except Exception as e:
            logger.error("Failed to fetch sitemap %s: %s", sitemap_url, e)
            return []

        urls = []
        try:
            root = ET.fromstring(response.content)
            # Handle XML namespace
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            for url_elem in root.findall(".//sm:url/sm:loc", ns):
                url = url_elem.text
                if url and (path_filter is None or path_filter in url):
                    urls.append(url)

            # Also try without namespace (some sitemaps don't use it)
            if not urls:
                for url_elem in root.iter():
                    if url_elem.tag.endswith("loc") and url_elem.text:
                        url = url_elem.text
                        if path_filter is None or path_filter in url:
                            urls.append(url)

        except ET.ParseError as e:
            logger.error("Failed to parse sitemap XML %s: %s", sitemap_url, e)

        logger.info(
            "Found %d URLs in sitemap %s (filter=%s)",
            len(urls), sitemap_url, path_filter,
        )
        return urls

    def ingest_source(
        self,
        source_config: dict,
        force: bool = False,
    ) -> IngestResult:
        """Ingest all pages from a single source configuration.

        Args:
            source_config: A source entry from sources.yaml.
            force: If True, re-ingest even if content hasn't changed.
        """
        name = source_config.get("name", source_config.get("url", "unknown"))
        url = source_config["url"]
        result = IngestResult(source_name=name)
        start_time = time.time()

        console.print(f"\n  [bold]{name}[/bold] ({url})")

        # Discover pages via sitemap or single URL
        sitemap = source_config.get("sitemap")
        sitemap_filter = source_config.get("sitemap_filter")
        if sitemap:
            page_urls = self.fetch_sitemap(sitemap, sitemap_filter)
            if not page_urls:
                # Fallback to direct URL if sitemap fails
                page_urls = [url]
        else:
            page_urls = [url]

        result.total_fetched = len(page_urls)
        console.print(f"    Found {len(page_urls)} pages to process")

        content_selector = source_config.get("content_selector")
        remove_selector = source_config.get("remove_selector")
        content_type = source_config.get("content_type", "documentation")
        language_sdk = source_config.get("language_sdk")
        tags = source_config.get("tags", [])

        docs_to_index = []

        for page_url in page_urls:
            # Fetch page via Jina Reader
            page = self.fetch_page(page_url, content_selector, remove_selector)
            if page is None:
                result.errors += 1
                continue

            # Check if content has changed
            if not force and not self.should_reingest(page_url, page["content"]):
                result.skipped += 1
                continue

            # Prepare document
            doc = self.prepare_document(
                title=page["title"],
                body=page["content"],
                url=page_url,
                content_type=content_type,
                language_sdk=language_sdk,
                tags=tags,
            )
            docs_to_index.append(doc)

        # Bulk index
        if docs_to_index:
            indexed, errors = self.bulk_index(docs_to_index)
            result.indexed = indexed
            result.errors += errors
        else:
            console.print("    [dim]No new content to index.[/dim]")

        result.elapsed_seconds = time.time() - start_time
        console.print(f"    {result}")
        return result

    def ingest_tier(
        self,
        tier_sources: list[dict],
        force: bool = False,
    ) -> list[IngestResult]:
        """Ingest all sources in a given tier.

        Args:
            tier_sources: List of source configurations from sources.yaml.
            force: If True, re-ingest even if content hasn't changed.
        """
        results = []
        for source in tier_sources:
            # Skip GitHub repos (handled by connector)
            if "repo" in source:
                continue
            # Skip sources that target a different index
            target_index = source.get("index", self.index_name)
            if target_index != self.index_name:
                # Create a new ingestor for this target index
                ingestor = JinaReaderIngestor(
                    es_client=self.es,
                    index_name=target_index,
                    source_tier=self.source_tier,
                    jina_api_key=self.jina_api_key,
                    rate_limit=self.rate_limit,
                    dry_run=self.dry_run,
                )
                result = ingestor.ingest_source(source, force=force)
            else:
                result = self.ingest_source(source, force=force)
            results.append(result)

        return results
