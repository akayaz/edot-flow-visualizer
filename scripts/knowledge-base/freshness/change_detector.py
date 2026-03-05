"""Content change detection using SHA-256 hashing.

Compares content hashes to determine if a document needs re-ingestion.
Used by JinaReaderIngestor and GitHubSupplementIngestor to avoid
redundant re-indexing of unchanged content.

Usage:
    python -m freshness.change_detector --index edot-assistant-docs-elastic --url "https://example.com"
"""

import hashlib
import logging
import os
import sys

import click
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)


def get_es_client() -> Elasticsearch:
    """Create an Elasticsearch client from environment variables."""
    url = os.environ.get("ELASTICSEARCH_URL")
    api_key = os.environ.get("ELASTICSEARCH_API_KEY")
    if not url or not api_key:
        console.print(
            "[red]Error:[/red] ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY "
            "must be set."
        )
        sys.exit(1)
    return Elasticsearch(url, api_key=api_key)


def compute_hash(content: str) -> str:
    """Compute SHA-256 hash of content string."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def get_stored_hash(es: Elasticsearch, index: str, url: str) -> str | None:
    """Look up the stored content_hash for a URL in the given index."""
    try:
        result = es.search(
            index=index,
            body={
                "query": {"term": {"url": url}},
                "size": 1,
                "_source": ["content_hash", "last_crawled", "title"],
            },
        )
        if result["hits"]["total"]["value"] == 0:
            return None
        return result["hits"]["hits"][0]["_source"].get("content_hash")
    except Exception as e:
        logger.warning("Error querying stored hash for %s: %s", url, e)
        return None


def should_reingest(es: Elasticsearch, index: str, url: str, new_content: str) -> bool:
    """Determine if content has changed and needs re-ingestion.

    Returns True if:
    - The URL doesn't exist in the index yet (new document)
    - The stored content_hash differs from the hash of new_content
    """
    new_hash = compute_hash(new_content)
    stored_hash = get_stored_hash(es, index, url)

    if stored_hash is None:
        logger.info("URL %s is new (not in index)", url)
        return True

    if stored_hash != new_hash:
        logger.info("URL %s content has changed (hash mismatch)", url)
        return True

    logger.debug("URL %s unchanged (hash match)", url)
    return False


def check_duplicates(es: Elasticsearch, index: str) -> list[dict]:
    """Find documents with duplicate URLs in an index."""
    try:
        result = es.search(
            index=index,
            body={
                "size": 0,
                "aggs": {
                    "duplicate_urls": {
                        "terms": {
                            "field": "url",
                            "min_doc_count": 2,
                            "size": 100,
                        }
                    }
                },
            },
        )
        buckets = result["aggregations"]["duplicate_urls"]["buckets"]
        return [{"url": b["key"], "count": b["doc_count"]} for b in buckets]
    except Exception as e:
        logger.error("Error checking duplicates: %s", e)
        return []


@click.command()
@click.option("--index", required=True, help="Elasticsearch index to check.")
@click.option("--url", default=None, help="Check a specific URL for changes.")
@click.option("--check-duplicates", "dupes", is_flag=True, help="Find duplicate URLs.")
def main(index: str, url: str | None, dupes: bool) -> None:
    """Content change detection utilities."""
    console.print("[bold blue]EDOT Assistant — Change Detector[/bold blue]")

    es = get_es_client()

    if dupes:
        console.print(f"\n[bold]Checking duplicates in {index}...[/bold]")
        duplicates = check_duplicates(es, index)
        if duplicates:
            table = Table(title=f"Duplicate URLs in {index}")
            table.add_column("URL", style="cyan")
            table.add_column("Count", justify="right", style="red")
            for d in duplicates:
                table.add_row(d["url"], str(d["count"]))
            console.print(table)
        else:
            console.print("[green]No duplicates found.[/green]")
        return

    if url:
        stored = get_stored_hash(es, index, url)
        if stored:
            console.print(f"Stored hash for {url}: {stored}")
        else:
            console.print(f"[yellow]No document found for URL:[/yellow] {url}")
        return

    console.print("Use --url to check a specific URL or --check-duplicates to find dupes.")


if __name__ == "__main__":
    main()
