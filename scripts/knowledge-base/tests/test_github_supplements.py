"""Unit tests for the GitHub supplements ingestion pipeline."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch, Mock

import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingest.github_supplements import GitHubSupplementIngestor


class TestGitHubSupplementIngestor:
    """Tests for GitHubSupplementIngestor."""

    def setup_method(self):
        self.mock_es = MagicMock()
        self.ingestor = GitHubSupplementIngestor(
            es_client=self.mock_es,
            index_name="edot-kb-github",
            source_tier="tier_2",
            github_token="test-token",
        )

    def test_github_headers(self):
        """Headers should include token and accept header."""
        headers = self.ingestor._github_headers()
        assert headers["Authorization"] == "token test-token"
        assert "application/vnd.github" in headers["Accept"]

    @patch("ingest.github_supplements.requests.get")
    def test_fetch_releases_success(self, mock_get):
        """Should fetch and parse GitHub releases."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"X-RateLimit-Remaining": "4999"}
        mock_response.json.return_value = [
            {
                "tag_name": "v1.0.0",
                "name": "Release v1.0.0",
                "body": "## What's Changed\n- New feature A\n- Bug fix B",
                "published_at": "2024-01-15T10:00:00Z",
                "html_url": "https://github.com/elastic/otel/releases/tag/v1.0.0",
            },
            {
                "tag_name": "v0.9.0",
                "name": "Release v0.9.0",
                "body": "## What's Changed\n- Initial release",
                "published_at": "2024-01-01T10:00:00Z",
                "html_url": "https://github.com/elastic/otel/releases/tag/v0.9.0",
            },
        ]
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        docs = self.ingestor.fetch_releases("elastic/otel", limit=5)
        assert len(docs) == 2
        assert docs[0]["content_type"] == "release"
        assert "v1.0.0" in docs[0]["body"]
        assert docs[0]["release_tag"] == "v1.0.0"
        assert docs[0]["repo"] == "elastic/otel"

    @patch("ingest.github_supplements.requests.get")
    def test_fetch_releases_empty(self, mock_get):
        """Should handle repos with no releases."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"X-RateLimit-Remaining": "4999"}
        mock_response.json.return_value = []
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        docs = self.ingestor.fetch_releases("elastic/otel")
        assert len(docs) == 0

    @patch("ingest.github_supplements.requests.get")
    def test_fetch_releases_no_body(self, mock_get):
        """Should skip releases without a body/changelog."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"X-RateLimit-Remaining": "4999"}
        mock_response.json.return_value = [
            {
                "tag_name": "v1.0.0",
                "name": "Release v1.0.0",
                "body": "",
                "published_at": "2024-01-15T10:00:00Z",
                "html_url": "https://github.com/test/repo/releases/tag/v1.0.0",
            },
        ]
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        docs = self.ingestor.fetch_releases("test/repo")
        assert len(docs) == 0

    @patch("ingest.github_supplements.requests.get")
    def test_fetch_yaml_configs(self, mock_get):
        """Should fetch YAML files from specified directories."""
        # First call: tree API
        tree_response = Mock()
        tree_response.status_code = 200
        tree_response.headers = {"X-RateLimit-Remaining": "4999"}
        tree_response.json.return_value = {
            "tree": [
                {"path": "examples/config.yaml", "type": "blob", "size": 500},
                {"path": "examples/setup.yml", "type": "blob", "size": 300},
                {"path": "examples/readme.md", "type": "blob", "size": 200},
                {"path": "src/main.py", "type": "blob", "size": 1000},
            ]
        }
        tree_response.raise_for_status = Mock()

        # Second call: raw content
        raw_response = Mock()
        raw_response.status_code = 200
        raw_response.headers = {"X-RateLimit-Remaining": "4998"}
        raw_response.text = "receivers:\n  otlp:\n    protocols:\n      grpc: {}"
        raw_response.raise_for_status = Mock()

        mock_get.side_effect = [tree_response, raw_response, raw_response]

        docs = self.ingestor.fetch_yaml_configs("elastic/otel", ["examples"])
        assert len(docs) == 2  # config.yaml and setup.yml
        for doc in docs:
            assert doc["content_type"] == "yaml_config"
            assert "yaml" in doc["tags"]
            assert "code_semantic" in doc
            assert "receivers" in doc["code_semantic"]

    @patch("ingest.github_supplements.requests.get")
    def test_fetch_code_examples(self, mock_get):
        """Should fetch code examples from target directories."""
        tree_response = Mock()
        tree_response.status_code = 200
        tree_response.headers = {"X-RateLimit-Remaining": "4999"}
        tree_response.json.return_value = {
            "tree": [
                {"path": "examples/demo.py", "type": "blob", "size": 800},
                {"path": "examples/helper.java", "type": "blob", "size": 600},
                {"path": "examples/data.json", "type": "blob", "size": 400},  # Not code
            ]
        }
        tree_response.raise_for_status = Mock()

        raw_response = Mock()
        raw_response.status_code = 200
        raw_response.headers = {"X-RateLimit-Remaining": "4998"}
        raw_response.text = "print('hello world')"
        raw_response.raise_for_status = Mock()

        mock_get.side_effect = [tree_response, raw_response, raw_response]

        docs = self.ingestor.fetch_code_examples("elastic/otel", ["examples"])
        assert len(docs) == 2  # .py and .java only
        for doc in docs:
            assert doc["content_type"] == "code_example"
            assert doc["code_semantic"] == "print('hello world')"

    @patch("ingest.github_supplements.requests.get")
    def test_fetch_code_examples_respects_size_limit(self, mock_get):
        """Should skip files larger than MAX_FILE_SIZE."""
        tree_response = Mock()
        tree_response.status_code = 200
        tree_response.headers = {"X-RateLimit-Remaining": "4999"}
        tree_response.json.return_value = {
            "tree": [
                {"path": "examples/huge.py", "type": "blob", "size": 200_000},
                {"path": "examples/small.py", "type": "blob", "size": 500},
            ]
        }
        tree_response.raise_for_status = Mock()

        raw_response = Mock()
        raw_response.status_code = 200
        raw_response.headers = {"X-RateLimit-Remaining": "4998"}
        raw_response.text = "x = 1"
        raw_response.raise_for_status = Mock()

        mock_get.side_effect = [tree_response, raw_response]

        docs = self.ingestor.fetch_code_examples("elastic/otel", ["examples"])
        assert len(docs) == 1  # Only the small file

    @patch("ingest.github_supplements.requests.get")
    def test_fetch_yaml_configs_tree_is_loaded_once(self, mock_get):
        """Repo tree should be fetched once even with multiple directories."""
        tree_response = Mock()
        tree_response.status_code = 200
        tree_response.headers = {"X-RateLimit-Remaining": "4999"}
        tree_response.json.return_value = {
            "tree": [
                {"path": "docs/collector.yml", "type": "blob", "size": 200},
            ]
        }
        tree_response.raise_for_status = Mock()

        raw_response = Mock()
        raw_response.status_code = 200
        raw_response.headers = {"X-RateLimit-Remaining": "4998"}
        raw_response.text = "processors:\n  batch: {}"
        raw_response.raise_for_status = Mock()

        mock_get.side_effect = [tree_response, raw_response]
        docs = self.ingestor.fetch_yaml_configs("elastic/otel", ["docs", "examples"])

        assert len(docs) == 1
        tree_calls = [
            c for c in mock_get.call_args_list
            if "/git/trees/" in c.args[0]
        ]
        assert len(tree_calls) == 1

    def test_ingest_repo_dry_run(self):
        """Dry run should not index any documents."""
        self.ingestor.dry_run = True

        with patch.object(self.ingestor, "fetch_releases", return_value=[]), \
             patch.object(self.ingestor, "fetch_yaml_configs", return_value=[]), \
             patch.object(self.ingestor, "fetch_code_examples", return_value=[]):

            repo_config = {
                "repo": "elastic/otel",
                "name": "EDOT Main",
                "supplement_dirs": ["examples"],
            }
            result = self.ingestor.ingest_repo(repo_config)
            assert result.source_name == "EDOT Main"
            self.mock_es.index.assert_not_called()

    @patch("ingest.github_supplements.requests.get")
    def test_rate_limit_awareness(self, mock_get):
        """Should handle low rate limits gracefully."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {
            "X-RateLimit-Remaining": "50",  # Low but not critical
            "X-RateLimit-Reset": "0",
        }
        mock_response.json.return_value = []
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        # Should not raise, just log a warning
        result = self.ingestor._github_get("/repos/test/repo/releases")
        assert result == []

    @patch("ingest.github_supplements.requests.get")
    def test_404_returns_none(self, mock_get):
        """404 responses should return None, not raise."""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.headers = {"X-RateLimit-Remaining": "4999"}
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = self.ingestor._github_get("/repos/nonexistent/repo")
        assert result is None
