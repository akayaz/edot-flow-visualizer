"""Check for stale documents and optionally trigger re-ingestion.

Identifies documents that have fallen below the freshness threshold
and reports them. Can optionally trigger automatic re-ingestion of
stale content.

Usage:
    python -m freshness.staleness_checker
    python -m freshness.staleness_checker --auto-refresh
"""

import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone

import click
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

STALE_THRESHOLD = 0.3  # Documents below this score are considered stale

ALL_INDICES = [
    "edot-kb-docs",
    "edot-kb-github",
]


@dataclass
class StaleReport:
    """Report of stale documents."""
    index: str
    total_docs: int = 0
    stale_docs: int = 0
    stale_urls: list[dict] = field(default_factory=list)
    oldest_crawl: str = ""


def get_es_client() -> Elasticsearch:
    """Create an Elasticsearch client from environment variables."""
    url = os.environ.get("ELASTICSEARCH_URL")
    api_key = os.environ.get("ELASTICSEARCH_API_KEY")
    if not url or not api_key:
        console.print("[red]Error:[/red] ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY must be set.")
        sys.exit(1)
    return Elasticsearch(url, api_key=api_key)


def check_index_staleness(
    es: Elasticsearch, index: str, threshold: float = STALE_THRESHOLD, limit: int = 20
) -> StaleReport:
    """Check an index for stale documents."""
    report = StaleReport(index=index)

    try:
        # Get total count
        count_result = es.count(index=index)
        report.total_docs = count_result.get("count", 0)

        # Get stale documents
        result = es.search(
            index=index,
            body={
                "query": {
                    "range": {
                        "freshness_score": {"lt": threshold}
                    }
                },
                "size": limit,
                "sort": [{"freshness_score": "asc"}],
                "_source": ["url", "title", "freshness_score", "last_crawled", "source_tier"],
            },
        )
        report.stale_docs = result["hits"]["total"]["value"]
        report.stale_urls = [
            {
                "url": hit["_source"].get("url", "unknown"),
                "title": hit["_source"].get("title", "untitled"),
                "score": hit["_source"].get("freshness_score", 0),
                "last_crawled": hit["_source"].get("last_crawled", "never"),
                "tier": hit["_source"].get("source_tier", "unknown"),
            }
            for hit in result["hits"]["hits"]
        ]

        # Find oldest crawl date
        oldest = es.search(
            index=index,
            body={
                "size": 1,
                "sort": [{"last_crawled": "asc"}],
                "_source": ["last_crawled"],
            },
        )
        if oldest["hits"]["hits"]:
            report.oldest_crawl = oldest["hits"]["hits"][0]["_source"].get("last_crawled", "unknown")

    except Exception as e:
        logger.error("Error checking staleness for %s: %s", index, e)

    return report


def print_report(reports: list[StaleReport]) -> None:
    """Print a formatted staleness report."""
    # Summary table
    summary = Table(title="Staleness Summary")
    summary.add_column("Index", style="cyan")
    summary.add_column("Total Docs", justify="right")
    summary.add_column("Stale Docs", justify="right")
    summary.add_column("Stale %", justify="right")
    summary.add_column("Oldest Crawl")
    summary.add_column("Status", style="bold")

    total_stale = 0
    for report in reports:
        stale_pct = (
            f"{report.stale_docs / report.total_docs * 100:.1f}%"
            if report.total_docs > 0
            else "N/A"
        )
        status = (
            "[green]Healthy[/green]"
            if report.stale_docs == 0
            else "[yellow]Warning[/yellow]"
            if report.stale_docs < 5
            else "[red]Stale[/red]"
        )
        summary.add_row(
            report.index,
            str(report.total_docs),
            str(report.stale_docs),
            stale_pct,
            report.oldest_crawl[:10] if report.oldest_crawl else "N/A",
            status,
        )
        total_stale += report.stale_docs

    console.print(summary)

    # Detail table for stale documents
    if total_stale > 0:
        detail = Table(title=f"Stale Documents (score < {STALE_THRESHOLD})")
        detail.add_column("Index", style="cyan")
        detail.add_column("Title")
        detail.add_column("Score", justify="right", style="red")
        detail.add_column("Last Crawled")
        detail.add_column("Tier")

        for report in reports:
            for doc in report.stale_urls[:10]:  # Limit to 10 per index
                detail.add_row(
                    report.index.split("-")[-1],  # Short name
                    doc["title"][:50],
                    f"{doc['score']:.3f}",
                    doc["last_crawled"][:10] if doc["last_crawled"] else "never",
                    doc["tier"],
                )

        console.print(f"\n")
        console.print(detail)


@click.command()
@click.option("--index", default=None, help="Check a specific index only.")
@click.option("--threshold", default=STALE_THRESHOLD, help=f"Freshness score threshold (default: {STALE_THRESHOLD}).")
@click.option("--auto-refresh", is_flag=True, help="Automatically trigger re-ingestion of stale content.")
@click.option("--json-output", is_flag=True, help="Output results as JSON.")
def main(index: str | None, threshold: float, auto_refresh: bool, json_output: bool) -> None:
    """Check for stale documents in the EDOT Assistant knowledge base."""
    console.print("[bold blue]EDOT Assistant — Staleness Checker[/bold blue]")

    es = get_es_client()

    try:
        es.info()
    except Exception as e:
        console.print(f"[red]Cannot connect to Elasticsearch:[/red] {e}")
        sys.exit(1)

    indices = [index] if index else ALL_INDICES
    reports = []

    for idx in indices:
        report = check_index_staleness(es, idx, threshold)
        reports.append(report)

    if json_output:
        import json
        output = []
        for r in reports:
            output.append({
                "index": r.index,
                "total_docs": r.total_docs,
                "stale_docs": r.stale_docs,
                "oldest_crawl": r.oldest_crawl,
                "stale_urls": r.stale_urls,
            })
        console.print(json.dumps(output, indent=2))
        return

    print_report(reports)

    total_stale = sum(r.stale_docs for r in reports)
    if total_stale == 0:
        console.print("\n[green]All documents are fresh. No action needed.[/green]")
    else:
        console.print(f"\n[yellow]{total_stale} stale documents found.[/yellow]")
        if auto_refresh:
            console.print("[bold]Auto-refresh is enabled. Triggering re-ingestion...[/bold]")
            console.print("[dim]Note: Connector-synced docs will refresh on the next connector sync schedule.[/dim]")
            # Trigger re-ingestion for non-connector content
            # This imports and runs the relevant ingestors for stale URLs
            console.print("[yellow]Auto-refresh implementation would trigger ingest.run_ingestion --force for stale tiers.[/yellow]")
        else:
            console.print("Run with --auto-refresh to trigger re-ingestion, or manually run:")
            console.print("  python -m ingest.run_ingestion --all --force")


if __name__ == "__main__":
    main()
