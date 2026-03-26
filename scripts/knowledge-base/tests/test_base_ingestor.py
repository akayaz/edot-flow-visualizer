"""Unit tests for BaseIngestor shared logic."""

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingest.base import BaseIngestor, IngestResult, TIER_MAX_AGE_DAYS


class TestBaseIngestor:
    """Tests for BaseIngestor shared logic."""

    def setup_method(self) -> None:
        self.mock_es = MagicMock()
        self.ingestor = BaseIngestor(
            es_client=self.mock_es,
            index_name="test-index",
            source_tier="tier_1",
        )

    def test_content_hash_consistency(self) -> None:
        content = "Hello, world!"
        hash1 = self.ingestor.content_hash(content)
        hash2 = self.ingestor.content_hash(content)
        assert hash1 == hash2
        assert len(hash1) == 64

    def test_content_hash_uniqueness(self) -> None:
        hash1 = self.ingestor.content_hash("Content A")
        hash2 = self.ingestor.content_hash("Content B")
        assert hash1 != hash2

    def test_content_hash_matches_sha256(self) -> None:
        content = "Test content"
        expected = hashlib.sha256(content.encode("utf-8")).hexdigest()
        assert self.ingestor.content_hash(content) == expected

    def test_should_reingest_new_document(self) -> None:
        self.mock_es.search.return_value = {"hits": {"total": {"value": 0}, "hits": []}}
        assert self.ingestor.should_reingest("https://example.com", "new content") is True

    def test_should_reingest_changed_content(self) -> None:
        old_hash = hashlib.sha256(b"old content").hexdigest()
        self.mock_es.search.return_value = {
            "hits": {
                "total": {"value": 1},
                "hits": [{"_source": {"content_hash": old_hash}}],
            }
        }
        assert self.ingestor.should_reingest("https://example.com", "new content") is True

    def test_should_not_reingest_unchanged_content(self) -> None:
        content = "same content"
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        self.mock_es.search.return_value = {
            "hits": {
                "total": {"value": 1},
                "hits": [{"_source": {"content_hash": content_hash}}],
            }
        }
        assert self.ingestor.should_reingest("https://example.com", content) is False

    def test_should_reingest_on_error(self) -> None:
        self.mock_es.search.side_effect = Exception("Connection error")
        assert self.ingestor.should_reingest("https://example.com", "content") is True

    def test_freshness_score_fresh(self) -> None:
        now = datetime.now(timezone.utc)
        score = self.ingestor.calculate_freshness_score("tier_1", now)
        assert score == pytest.approx(1.0, abs=0.01)

    def test_freshness_score_stale(self) -> None:
        from datetime import timedelta
        old_date = datetime.now(timezone.utc) - timedelta(days=30)
        score = self.ingestor.calculate_freshness_score("tier_1", old_date)
        assert score == 0.0

    def test_freshness_score_halfway(self) -> None:
        from datetime import timedelta
        max_age = TIER_MAX_AGE_DAYS["tier_1"]
        half_date = datetime.now(timezone.utc) - timedelta(days=max_age / 2)
        score = self.ingestor.calculate_freshness_score("tier_1", half_date)
        assert 0.45 <= score <= 0.55

    def test_freshness_score_none_returns_1(self) -> None:
        score = self.ingestor.calculate_freshness_score("tier_1", None)
        assert score == 1.0

    def test_prepare_document_has_required_fields(self) -> None:
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

    def test_prepare_document_with_extra_fields(self) -> None:
        doc = self.ingestor.prepare_document(
            title="Test",
            body="Body",
            url="https://example.com",
            extra_fields={"repo": "elastic/opentelemetry", "release_tag": "v1.0"},
        )
        assert doc["repo"] == "elastic/opentelemetry"
        assert doc["release_tag"] == "v1.0"

    def test_prepare_document_with_code_content(self) -> None:
        doc = self.ingestor.prepare_document(
            title="Code Sample",
            body="Wrapper text",
            url="https://example.com/code",
            code_content="receivers:\n  otlp:",
        )
        assert doc["code_semantic"] == "receivers:\n  otlp:"

    def test_index_document_dry_run(self) -> None:
        self.ingestor.dry_run = True
        result = self.ingestor.index_document({"url": "test", "body": "test"})
        assert result is True
        self.mock_es.index.assert_not_called()

    def test_bulk_index_empty(self) -> None:
        success, errors = self.ingestor.bulk_index([])
        assert success == 0
        assert errors == 0

    def test_bulk_index_dry_run(self) -> None:
        self.ingestor.dry_run = True
        docs = [{"url": "test1"}, {"url": "test2"}]
        success, errors = self.ingestor.bulk_index(docs)
        assert success == 2
        assert errors == 0


class TestIngestResult:
    """Tests for IngestResult dataclass."""

    def test_success_rate_with_results(self) -> None:
        result = IngestResult(source_name="test", total_fetched=10, indexed=8)
        assert result.success_rate == 0.8

    def test_success_rate_zero_fetched(self) -> None:
        result = IngestResult(source_name="test", total_fetched=0)
        assert result.success_rate == 0.0

    def test_str_representation(self) -> None:
        result = IngestResult(
            source_name="Test Source",
            total_fetched=10,
            indexed=8,
            skipped=1,
            errors=1,
            elapsed_seconds=5.5,
        )
        rendered = str(result)
        assert "Test Source" in rendered
        assert "fetched=10" in rendered
        assert "indexed=8" in rendered
