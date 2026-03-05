"""Unit tests for freshness management components."""

import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from freshness.change_detector import compute_hash, should_reingest, check_duplicates
from ingest.base import BaseIngestor, TIER_MAX_AGE_DAYS


# ─── Change Detector Tests ─────────────────────────────────────


class TestChangeDetector:
    """Tests for the change detection module."""

    def test_compute_hash_consistency(self):
        """Same content should always produce same hash."""
        content = "Hello, EDOT!"
        h1 = compute_hash(content)
        h2 = compute_hash(content)
        assert h1 == h2

    def test_compute_hash_is_sha256(self):
        """Hash should be valid SHA-256."""
        content = "Test content"
        h = compute_hash(content)
        expected = hashlib.sha256(content.encode("utf-8")).hexdigest()
        assert h == expected
        assert len(h) == 64

    def test_compute_hash_different_for_different_content(self):
        """Different content must produce different hashes."""
        h1 = compute_hash("Content version 1")
        h2 = compute_hash("Content version 2")
        assert h1 != h2

    def test_compute_hash_empty_string(self):
        """Empty string should produce a valid hash."""
        h = compute_hash("")
        assert len(h) == 64

    def test_compute_hash_unicode(self):
        """Unicode content should hash correctly."""
        h = compute_hash("Elasticsearch ❤️ OpenTelemetry")
        assert len(h) == 64

    def test_should_reingest_new_url(self):
        """New URL (not in index) should require re-ingestion."""
        mock_es = MagicMock()
        mock_es.search.return_value = {"hits": {"total": {"value": 0}, "hits": []}}

        result = should_reingest(mock_es, "test-index", "https://new-url.com", "content")
        assert result is True

    def test_should_reingest_changed_content(self):
        """Changed content should require re-ingestion."""
        mock_es = MagicMock()
        old_hash = compute_hash("old content")
        mock_es.search.return_value = {
            "hits": {
                "total": {"value": 1},
                "hits": [{"_source": {"content_hash": old_hash}}],
            }
        }

        result = should_reingest(mock_es, "test-index", "https://example.com", "new content")
        assert result is True

    def test_should_not_reingest_same_content(self):
        """Unchanged content should not require re-ingestion."""
        mock_es = MagicMock()
        content = "unchanged content"
        content_hash = compute_hash(content)
        mock_es.search.return_value = {
            "hits": {
                "total": {"value": 1},
                "hits": [{"_source": {"content_hash": content_hash}}],
            }
        }

        result = should_reingest(mock_es, "test-index", "https://example.com", content)
        assert result is False

    def test_should_reingest_on_es_error(self):
        """Should assume re-ingestion needed on Elasticsearch errors."""
        mock_es = MagicMock()
        mock_es.search.side_effect = Exception("Connection refused")

        result = should_reingest(mock_es, "test-index", "https://example.com", "content")
        assert result is True

    def test_check_duplicates_found(self):
        """Should find duplicate URLs."""
        mock_es = MagicMock()
        mock_es.search.return_value = {
            "aggregations": {
                "duplicate_urls": {
                    "buckets": [
                        {"key": "https://example.com/page1", "doc_count": 3},
                        {"key": "https://example.com/page2", "doc_count": 2},
                    ]
                }
            }
        }

        dupes = check_duplicates(mock_es, "test-index")
        assert len(dupes) == 2
        assert dupes[0]["url"] == "https://example.com/page1"
        assert dupes[0]["count"] == 3

    def test_check_duplicates_none(self):
        """Should return empty list when no duplicates exist."""
        mock_es = MagicMock()
        mock_es.search.return_value = {
            "aggregations": {
                "duplicate_urls": {
                    "buckets": []
                }
            }
        }

        dupes = check_duplicates(mock_es, "test-index")
        assert dupes == []

    def test_check_duplicates_error(self):
        """Should return empty list on error."""
        mock_es = MagicMock()
        mock_es.search.side_effect = Exception("Error")

        dupes = check_duplicates(mock_es, "test-index")
        assert dupes == []


# ─── Freshness Scoring Tests ──────────────────────────────────


class TestFreshnessScoring:
    """Tests for freshness score calculation logic."""

    def setup_method(self):
        self.mock_es = MagicMock()
        self.ingestor = BaseIngestor(
            es_client=self.mock_es,
            index_name="test-index",
            source_tier="tier_1",
        )

    def test_tier_thresholds_exist(self):
        """All 5 tiers should have defined thresholds."""
        for tier in ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"]:
            assert tier in TIER_MAX_AGE_DAYS

    def test_tier_1_threshold(self):
        """Tier 1 should have 14-day threshold."""
        assert TIER_MAX_AGE_DAYS["tier_1"] == 14

    def test_tier_2_threshold(self):
        """Tier 2 should have 21-day threshold."""
        assert TIER_MAX_AGE_DAYS["tier_2"] == 21

    def test_tier_3_threshold(self):
        """Tier 3 should have 30-day threshold."""
        assert TIER_MAX_AGE_DAYS["tier_3"] == 30

    def test_tier_4_5_threshold(self):
        """Tiers 4 and 5 should have 45-day threshold."""
        assert TIER_MAX_AGE_DAYS["tier_4"] == 45
        assert TIER_MAX_AGE_DAYS["tier_5"] == 45

    def test_freshness_just_crawled(self):
        """Document crawled just now should have score 1.0."""
        now = datetime.now(timezone.utc)
        score = self.ingestor.calculate_freshness_score("tier_1", now)
        assert score == pytest.approx(1.0, abs=0.01)

    def test_freshness_at_max_age(self):
        """Document at exactly max age should have score 0.0."""
        max_age = TIER_MAX_AGE_DAYS["tier_1"]
        old_date = datetime.now(timezone.utc) - timedelta(days=max_age)
        score = self.ingestor.calculate_freshness_score("tier_1", old_date)
        assert score == pytest.approx(0.0, abs=0.01)

    def test_freshness_beyond_max_age(self):
        """Document beyond max age should be clamped at 0.0."""
        old_date = datetime.now(timezone.utc) - timedelta(days=100)
        score = self.ingestor.calculate_freshness_score("tier_1", old_date)
        assert score == 0.0

    def test_freshness_at_quarter(self):
        """Document at 25% of max age should have score ~0.75."""
        max_age = TIER_MAX_AGE_DAYS["tier_2"]  # 21 days
        date = datetime.now(timezone.utc) - timedelta(days=max_age * 0.25)
        score = self.ingestor.calculate_freshness_score("tier_2", date)
        assert 0.70 <= score <= 0.80

    def test_freshness_at_three_quarters(self):
        """Document at 75% of max age should have score ~0.25."""
        max_age = TIER_MAX_AGE_DAYS["tier_3"]  # 30 days
        date = datetime.now(timezone.utc) - timedelta(days=max_age * 0.75)
        score = self.ingestor.calculate_freshness_score("tier_3", date)
        assert 0.20 <= score <= 0.30

    def test_freshness_none_date(self):
        """None date should return 1.0 (assume fresh)."""
        score = self.ingestor.calculate_freshness_score("tier_1", None)
        assert score == 1.0

    def test_freshness_unknown_tier(self):
        """Unknown tier should use default 30-day threshold."""
        date = datetime.now(timezone.utc) - timedelta(days=15)
        score = self.ingestor.calculate_freshness_score("unknown_tier", date)
        assert 0.45 <= score <= 0.55

    def test_freshness_score_is_float(self):
        """Score should always be a float."""
        now = datetime.now(timezone.utc)
        score = self.ingestor.calculate_freshness_score("tier_1", now)
        assert isinstance(score, float)

    def test_freshness_score_range(self):
        """Score should always be between 0.0 and 1.0."""
        for days in range(0, 100):
            date = datetime.now(timezone.utc) - timedelta(days=days)
            for tier in TIER_MAX_AGE_DAYS:
                score = self.ingestor.calculate_freshness_score(tier, date)
                assert 0.0 <= score <= 1.0, f"Score {score} out of range for {tier}, {days} days"

    def test_freshness_monotonically_decreasing(self):
        """Score should decrease as time since crawl increases."""
        prev_score = 1.0
        for days in range(0, 50):
            date = datetime.now(timezone.utc) - timedelta(days=days)
            score = self.ingestor.calculate_freshness_score("tier_1", date)
            assert score <= prev_score, (
                f"Score increased from {prev_score} to {score} at day {days}"
            )
            prev_score = score

    def test_naive_datetime_handled(self):
        """Naive datetime (no timezone) should be handled correctly."""
        date = datetime.now() - timedelta(days=7)
        score = self.ingestor.calculate_freshness_score("tier_1", date)
        assert 0.0 <= score <= 1.0
