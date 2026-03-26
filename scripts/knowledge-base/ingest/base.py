"""Base ingestion class with shared logic for all EDOT Assistant pipelines.

Provides content hashing, bulk indexing, freshness scoring, and retry logic.
"""

import hashlib
import logging
import time
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional

from elasticsearch import Elasticsearch, helpers
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

console = Console()
logger = logging.getLogger(__name__)

# Freshness thresholds by tier (max age in days)
TIER_MAX_AGE_DAYS = {
    "tier_1": 14,
    "tier_2": 21,
    "tier_3": 30,
    "tier_4": 45,
    "tier_5": 45,
}

INGEST_PIPELINE_ID = "edot-assistant-processing"


@dataclass
class IngestResult:
    """Result of an ingestion operation."""

    source_name: str
    total_fetched: int = 0
    indexed: int = 0
    skipped: int = 0
    errors: int = 0
    elapsed_seconds: float = 0.0
    error_messages: list[str] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        if self.total_fetched == 0:
            return 0.0
        return self.indexed / self.total_fetched

    def __str__(self) -> str:
        return (
            f"{self.source_name}: "
            f"fetched={self.total_fetched}, indexed={self.indexed}, "
            f"skipped={self.skipped}, errors={self.errors}, "
            f"time={self.elapsed_seconds:.1f}s"
        )


class BaseIngestor:
    """Base class for all EDOT Assistant ingestion pipelines."""

    def __init__(
        self,
        es_client: Elasticsearch,
        index_name: str,
        source_tier: str,
        pipeline_id: str = INGEST_PIPELINE_ID,
        dry_run: bool = False,
    ) -> None:
        self.es = es_client
        self.index_name = index_name
        self.source_tier = source_tier
        self.pipeline_id = pipeline_id
        self.dry_run = dry_run

    def content_hash(self, content: str) -> str:
        """Generate SHA-256 hash of content for change detection."""
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def should_reingest(self, url: str, new_content: str) -> bool:
        """Check if content has changed since last ingestion.

        Compares SHA-256 hash of new content against stored content_hash.
        Returns True if content is new or has changed.
        """
        new_hash = self.content_hash(new_content)
        try:
            result = self.es.search(
                index=self.index_name,
                body={
                    "query": {"term": {"url": url}},
                    "size": 1,
                    "_source": ["content_hash"],
                },
            )
            if result["hits"]["total"]["value"] == 0:
                return True
            existing_hash = result["hits"]["hits"][0]["_source"].get("content_hash")
            return existing_hash != new_hash
        except Exception as e:
            logger.warning("Error checking existing content for %s: %s", url, e)
            return True

    def calculate_freshness_score(
        self,
        tier: str,
        last_crawled: Optional[datetime] = None,
    ) -> float:
        """Calculate freshness score based on tier thresholds.

        Returns a float between 0.0 (stale) and 1.0 (fresh).
        Formula: max(0, 1.0 - (days_since_crawl / max_age_days))
        """
        if last_crawled is None:
            return 1.0

        max_age = TIER_MAX_AGE_DAYS.get(tier, 30)
        now = datetime.now(timezone.utc)
        if last_crawled.tzinfo is None:
            last_crawled = last_crawled.replace(tzinfo=timezone.utc)
        days_since = (now - last_crawled).total_seconds() / 86400
        return max(0.0, 1.0 - (days_since / max_age))

    def prepare_document(
        self,
        title: str,
        body: str,
        url: str,
        content_type: str = "documentation",
        language_sdk: Optional[str] = None,
        code_content: Optional[str] = None,
        tags: Optional[list[str]] = None,
        extra_fields: Optional[dict] = None,
    ) -> dict:
        """Prepare a document for indexing with standard fields."""
        doc = {
            "title": title,
            "body": body,
            "body_semantic": body,
            "url": url,
            "source_type": "web",
            "source_tier": self.source_tier,
            "content_type": content_type,
            "content_hash": self.content_hash(body),
            "tags": tags or [],
            "last_crawled": datetime.now(timezone.utc).isoformat(),
            "freshness_score": 1.0,
        }
        if language_sdk:
            doc["language_sdk"] = language_sdk
        if code_content:
            doc["code_semantic"] = code_content
        if extra_fields:
            doc.update(extra_fields)
        return doc

    def index_document(self, doc: dict) -> bool:
        """Index a single document with the ingest pipeline."""
        if self.dry_run:
            logger.info("DRY RUN: Would index document: %s", doc.get("url", "unknown"))
            return True
        try:
            self.es.index(
                index=self.index_name,
                body=doc,
                pipeline=self.pipeline_id,
            )
            return True
        except Exception as e:
            logger.error("Error indexing document %s: %s", doc.get("url", "unknown"), e)
            return False

    def bulk_index(self, docs: list[dict]) -> tuple[int, int]:
        """Bulk index documents with progress reporting.

        Returns (success_count, error_count).
        """
        if not docs:
            return (0, 0)

        if self.dry_run:
            console.print(f"  [dim]DRY RUN: Would index {len(docs)} documents.[/dim]")
            return (len(docs), 0)

        actions = []
        for doc in docs:
            action = {
                "_index": self.index_name,
                "_source": doc,
                "pipeline": self.pipeline_id,
            }
            actions.append(action)

        success = 0
        errors = 0

        try:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("{task.completed}/{task.total}"),
                console=console,
            ) as progress:
                task = progress.add_task("Indexing...", total=len(actions))

                for ok, info in helpers.streaming_bulk(
                    self.es,
                    actions,
                    chunk_size=100,
                    raise_on_error=False,
                    max_retries=3,
                ):
                    if ok:
                        success += 1
                    else:
                        errors += 1
                        logger.error("Bulk index error: %s", info)
                    progress.advance(task)

        except Exception as e:
            logger.error("Bulk indexing failed: %s", e)
            errors = len(actions) - success

        return (success, errors)

    def retry_with_backoff(
        self,
        func: callable,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 30.0,
    ):
        """Execute a function with exponential backoff retry.

        Retries on any exception, with delays of base_delay * 2^attempt.
        """
        last_exception = None
        for attempt in range(max_retries + 1):
            try:
                return func()
            except Exception as e:
                last_exception = e
                if attempt < max_retries:
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    logger.warning(
                        "Attempt %d/%d failed: %s. Retrying in %.1fs...",
                        attempt + 1, max_retries + 1, e, delay,
                    )
                    time.sleep(delay)
        raise last_exception
