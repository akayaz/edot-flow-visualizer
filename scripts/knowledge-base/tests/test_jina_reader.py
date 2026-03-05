"""Unit tests for the Jina Reader ingestion pipeline."""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch, Mock

import pytest

# Patch modules before importing
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingest.base import BaseIngestor, IngestResult, TIER_MAX_AGE_DAYS
from ingest.jina_reader import JinaReaderIngestor


# ─── BaseIngestor Tests ────────────────────────────────────────


class TestBaseIngestor:
    """Tests for BaseIngestor shared logic."""

    def setup_method(self):
        self.mock_es = MagicMock()
        self.ingestor = BaseIngestor(
            es_client=self.mock_es,
            index_name="test-index",
            source_tier="tier_1",
        )

    def test_content_hash_consistency(self):
        """Same content should always produce the same hash."""
        content = "Hello, world!"
        hash1 = self.ingestor.content_hash(content)
        hash2 = self.ingestor.content_hash(content)
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA-256 hex length

    def test_content_hash_uniqueness(self):
        """Different content should produce different hashes."""
        hash1 = self.ingestor.content_hash("Content A")
        hash2 = self.ingestor.content_hash("Content B")
        assert hash1 != hash2

    def test_content_hash_matches_sha256(self):
        """Hash should match standard SHA-256."""
        content = "Test content"
        expected = hashlib.sha256(content.encode("utf-8")).hexdigest()
        assert self.ingestor.content_hash(content) == expected

    def test_should_reingest_new_document(self):
        """New documents (not in index) should be re-ingested."""
        self.mock_es.search.return_value = {"hits": {"total": {"value": 0}, "hits": []}}
        assert self.ingestor.should_reingest("https://example.com", "new content") is True

    def test_should_reingest_changed_content(self):
        """Changed content should trigger re-ingestion."""
        old_hash = hashlib.sha256(b"old content").hexdigest()
        self.mock_es.search.return_value = {
            "hits": {
                "total": {"value": 1},
                "hits": [{"_source": {"content_hash": old_hash}}],
            }
        }
        assert self.ingestor.should_reingest("https://example.com", "new content") is True

    def test_should_not_reingest_unchanged_content(self):
        """Unchanged content should not be re-ingested."""
        content = "same content"
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        self.mock_es.search.return_value = {
            "hits": {
                "total": {"value": 1},
                "hits": [{"_source": {"content_hash": content_hash}}],
            }
        }
        assert self.ingestor.should_reingest("https://example.com", content) is False

    def test_should_reingest_on_error(self):
        """On error, assume re-ingestion is needed."""
        self.mock_es.search.side_effect = Exception("Connection error")
        assert self.ingestor.should_reingest("https://example.com", "content") is True

    def test_freshness_score_fresh(self):
        """Recently crawled document should have score close to 1.0."""
        now = datetime.now(timezone.utc)
        score = self.ingestor.calculate_freshness_score("tier_1", now)
        assert score == pytest.approx(1.0, abs=0.01)

    def test_freshness_score_stale(self):
        """Old document should have score of 0.0."""
        from datetime import timedelta
        old_date = datetime.now(timezone.utc) - timedelta(days=30)
        score = self.ingestor.calculate_freshness_score("tier_1", old_date)
        assert score == 0.0

    def test_freshness_score_halfway(self):
        """Document at half the max age should have score ~0.5."""
        from datetime import timedelta
        max_age = TIER_MAX_AGE_DAYS["tier_1"]  # 14 days
        half_date = datetime.now(timezone.utc) - timedelta(days=max_age / 2)
        score = self.ingestor.calculate_freshness_score("tier_1", half_date)
        assert 0.45 <= score <= 0.55

    def test_freshness_score_none_returns_1(self):
        """No last_crawled date should return 1.0."""
        score = self.ingestor.calculate_freshness_score("tier_1", None)
        assert score == 1.0

    def test_prepare_document_has_required_fields(self):
        """Prepared documents should have all required fields."""
        doc = self.ingestor.prepare_document(
            title="Test Title",
            body="Test body content",
            url="https://example.com",
            content_type="documentation",
        )
        assert doc["title"] == "Test Title"
        assert doc["body"] == "Test body content"
        assert doc["body_semantic"] == "Test body content"
        assert doc["url"] == "https://example.com"
        assert doc["content_type"] == "documentation"
        assert doc["source_tier"] == "tier_1"
        assert "content_hash" in doc
        assert "last_crawled" in doc
        assert doc["freshness_score"] == 1.0

    def test_prepare_document_with_extra_fields(self):
        """Extra fields should be included in the document."""
        doc = self.ingestor.prepare_document(
            title="Test",
            body="Body",
            url="https://example.com",
            extra_fields={"repo": "elastic/opentelemetry", "release_tag": "v1.0"},
        )
        assert doc["repo"] == "elastic/opentelemetry"
        assert doc["release_tag"] == "v1.0"

    def test_index_document_dry_run(self):
        """Dry run should not actually index."""
        self.ingestor.dry_run = True
        result = self.ingestor.index_document({"url": "test", "body": "test"})
        assert result is True
        self.mock_es.index.assert_not_called()

    def test_bulk_index_empty(self):
        """Bulk indexing empty list should return (0, 0)."""
        success, errors = self.ingestor.bulk_index([])
        assert success == 0
        assert errors == 0

    def test_bulk_index_dry_run(self):
        """Dry run bulk index should return all as successful."""
        self.ingestor.dry_run = True
        docs = [{"url": "test1"}, {"url": "test2"}]
        success, errors = self.ingestor.bulk_index(docs)
        assert success == 2
        assert errors == 0


# ─── JinaReaderIngestor Tests ─────────────────────────────────


class TestJinaReaderIngestor:
    """Tests for JinaReaderIngestor."""

    def setup_method(self):
        self.mock_es = MagicMock()
        self.ingestor = JinaReaderIngestor(
            es_client=self.mock_es,
            index_name="test-index",
            source_tier="tier_1",
            jina_api_key="test-key",
            rate_limit=0,  # No rate limiting in tests
        )

    def test_jina_headers_basic(self):
        """Headers should include API key and return format."""
        headers = self.ingestor._jina_headers()
        assert "Authorization" in headers
        assert headers["Authorization"] == "Bearer test-key"
        assert headers["X-Return-Format"] == "markdown"

    def test_jina_headers_with_selectors(self):
        """Headers should include CSS selectors when provided."""
        headers = self.ingestor._jina_headers(
            content_selector="article, .main-content",
            remove_selector="nav, footer",
        )
        assert headers["X-Target-Selector"] == "article, .main-content"
        assert headers["X-Remove-Selector"] == "nav, footer"

    @patch("ingest.jina_reader.requests.get")
    def test_fetch_page_success(self, mock_get):
        """Successful page fetch should return title and content."""
        mock_response = Mock()
        mock_response.text = "# Test Page\n\nThis is test content."
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = self.ingestor.fetch_page("https://example.com")
        assert result is not None
        assert result["title"] == "Test Page"
        assert "test content" in result["content"]
        assert result["url"] == "https://example.com"

    @patch("ingest.jina_reader.requests.get")
    def test_fetch_page_empty_content(self, mock_get):
        """Empty content should return None."""
        mock_response = Mock()
        mock_response.text = ""
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = self.ingestor.fetch_page("https://example.com")
        assert result is None

    @patch("ingest.jina_reader.requests.get")
    def test_fetch_page_error(self, mock_get):
        """HTTP error should return None."""
        mock_get.side_effect = Exception("Connection error")

        result = self.ingestor.fetch_page("https://example.com")
        assert result is None

    @patch("ingest.jina_reader.requests.get")
    def test_fetch_sitemap(self, mock_get):
        """Should parse XML sitemap and extract URLs."""
        sitemap_xml = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/docs/page1</loc></url>
            <url><loc>https://example.com/docs/page2</loc></url>
            <url><loc>https://example.com/blog/post1</loc></url>
        </urlset>"""
        mock_response = Mock()
        mock_response.content = sitemap_xml.encode()
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        urls = self.ingestor.fetch_sitemap(
            "https://example.com/sitemap.xml",
            path_filter="/docs/",
        )
        assert len(urls) == 2
        assert "https://example.com/docs/page1" in urls
        assert "https://example.com/docs/page2" in urls

    @patch("ingest.jina_reader.requests.get")
    def test_fetch_sitemap_no_filter(self, mock_get):
        """Without filter, should return all URLs."""
        sitemap_xml = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page1</loc></url>
            <url><loc>https://example.com/page2</loc></url>
        </urlset>"""
        mock_response = Mock()
        mock_response.content = sitemap_xml.encode()
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        urls = self.ingestor.fetch_sitemap("https://example.com/sitemap.xml")
        assert len(urls) == 2

    def test_ingest_source_skips_repos(self):
        """ingest_tier should skip GitHub repo sources."""
        sources = [
            {"repo": "elastic/opentelemetry", "name": "EDOT Main"},
            {"url": "https://example.com", "name": "Web Source"},
        ]
        # Mock fetch_page to return content for the web source
        with patch.object(self.ingestor, "fetch_page") as mock_fetch:
            mock_fetch.return_value = {
                "title": "Test",
                "content": "Test content",
                "url": "https://example.com",
            }
            self.mock_es.search.return_value = {
                "hits": {"total": {"value": 0}, "hits": []}
            }
            results = self.ingestor.ingest_tier(sources)
            # Only web source should be processed
            assert len(results) == 1


# ─── IngestResult Tests ───────────────────────────────────────


class TestIngestResult:
    """Tests for IngestResult dataclass."""

    def test_success_rate_with_results(self):
        result = IngestResult(source_name="test", total_fetched=10, indexed=8)
        assert result.success_rate == 0.8

    def test_success_rate_zero_fetched(self):
        result = IngestResult(source_name="test", total_fetched=0)
        assert result.success_rate == 0.0

    def test_str_representation(self):
        result = IngestResult(
            source_name="Test Source",
            total_fetched=10,
            indexed=8,
            skipped=1,
            errors=1,
            elapsed_seconds=5.5,
        )
        s = str(result)
        assert "Test Source" in s
        assert "fetched=10" in s
        assert "indexed=8" in s
