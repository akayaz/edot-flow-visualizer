"""Ingestion orchestrator for the EDOT Assistant knowledge base.

Central CLI entry point for running all ingestion pipelines. Supports
tier-based, source-specific, and full ingestion modes.

Usage:
    python -m ingest.run_ingestion --all
    python -m ingest.run_ingestion --tier 1
    python -m ingest.run_ingestion --source "elastic/opentelemetry"
    python -m ingest.run_ingestion --tier 1 --dry-run
    python -m ingest.run_ingestion --tier 1 --force
"""

import logging
import os
import sys
import time
from pathlib import Path

import click
import yaml
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from rich.console import Console
from rich.table import Table

from ingest.base import IngestResult
from ingest.jina_reader import JinaReaderIngestor
from ingest.github_supplements import GitHubSupplementIngestor

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

SOURCES_FILE = Path(__file__).parent.parent / "config" / "sources.yaml"

# Which tiers use which ingestor
JINA_TIERS = {"tier_1", "tier_3", "tier_4", "tier_5"}
GITHUB_TIERS = {"tier_2", "tier_3"}

# Tier to index mapping for Jina Reader
TIER_INDEX_MAP = {
    "tier_1": "edot-assistant-docs-elastic",
    "tier_3": "edot-assistant-docs-otel",
    "tier_4": "edot-assistant-blogs",
    "tier_5": "edot-assistant-community",
}

GITHUB_INDEX = "edot-assistant-github-repos"


def get_es_client() -> Elasticsearch:
    """Create an Elasticsearch client from environment variables."""
    url = os.environ.get("ELASTICSEARCH_URL")
    api_key = os.environ.get("ELASTICSEARCH_API_KEY")
    if not url or not api_key:
        console.print(
            "[red]Error:[/red] ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY "
            "must be set in environment or .env file."
        )
        sys.exit(1)
    return Elasticsearch(url, api_key=api_key)


def load_sources() -> dict:
    """Load the sources.yaml configuration."""
    with open(SOURCES_FILE, "r") as f:
        return yaml.safe_load(f)


def ingest_jina_tier(
    es: Elasticsearch,
    tier_key: str,
    sources: list[dict],
    dry_run: bool = False,
    force: bool = False,
) -> list[IngestResult]:
    """Run Jina Reader ingestion for a tier's web sources."""
    default_index = TIER_INDEX_MAP.get(tier_key, "edot-assistant-docs-elastic")
    web_sources = [s for s in sources if "url" in s]

    if not web_sources:
        return []

    ingestor = JinaReaderIngestor(
        es_client=es,
        index_name=default_index,
        source_tier=tier_key,
        dry_run=dry_run,
    )
    return ingestor.ingest_tier(web_sources, force=force)


def ingest_github_tier(
    es: Elasticsearch,
    tier_key: str,
    sources: list[dict],
    dry_run: bool = False,
    force: bool = False,
) -> list[IngestResult]:
    """Run GitHub supplements ingestion for a tier's repo sources."""
    repo_sources = [s for s in sources if "repo" in s]

    if not repo_sources:
        return []

    ingestor = GitHubSupplementIngestor(
        es_client=es,
        index_name=GITHUB_INDEX,
        source_tier=tier_key,
        dry_run=dry_run,
    )

    results = []
    for source in repo_sources:
        result = ingestor.ingest_repo(source, force=force)
        results.append(result)

    return results


def ingest_tier(
    es: Elasticsearch,
    tier_num: int,
    sources_config: dict,
    dry_run: bool = False,
    force: bool = False,
) -> list[IngestResult]:
    """Ingest all sources in a given tier."""
    tier_key = f"tier_{tier_num}"
    tier_sources = sources_config.get("sources", {}).get(tier_key, [])

    if not tier_sources:
        console.print(f"[yellow]No sources found for {tier_key}.[/yellow]")
        return []

    console.print(f"\n[bold cyan]Processing {tier_key} ({len(tier_sources)} sources)[/bold cyan]")

    results = []

    # Jina Reader for web content
    if tier_key in JINA_TIERS:
        jina_results = ingest_jina_tier(es, tier_key, tier_sources, dry_run, force)
        results.extend(jina_results)

    # GitHub supplements for repo content
    if tier_key in GITHUB_TIERS:
        github_results = ingest_github_tier(es, tier_key, tier_sources, dry_run, force)
        results.extend(github_results)

    return results


def ingest_source(
    es: Elasticsearch,
    source_id: str,
    sources_config: dict,
    dry_run: bool = False,
    force: bool = False,
) -> list[IngestResult]:
    """Ingest a specific source by URL or repo name."""
    results = []

    for tier_key in ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"]:
        tier_sources = sources_config.get("sources", {}).get(tier_key, [])
        for source in tier_sources:
            matched = (
                source.get("repo") == source_id
                or source.get("url") == source_id
                or source.get("name") == source_id
            )
            if not matched:
                continue

            console.print(f"\n[bold cyan]Found source in {tier_key}:[/bold cyan] {source.get('name', source_id)}")

            if "repo" in source:
                ingestor = GitHubSupplementIngestor(
                    es_client=es,
                    index_name=GITHUB_INDEX,
                    source_tier=tier_key,
                    dry_run=dry_run,
                )
                result = ingestor.ingest_repo(source, force=force)
                results.append(result)
            elif "url" in source:
                default_index = source.get("index", TIER_INDEX_MAP.get(tier_key, "edot-assistant-docs-elastic"))
                ingestor = JinaReaderIngestor(
                    es_client=es,
                    index_name=default_index,
                    source_tier=tier_key,
                    dry_run=dry_run,
                )
                result = ingestor.ingest_source(source, force=force)
                results.append(result)

    if not results:
        console.print(f"[yellow]Source not found:[/yellow] {source_id}")

    return results


def print_summary(all_results: list[IngestResult]) -> None:
    """Print a summary table of all ingestion results."""
    if not all_results:
        console.print("\n[dim]No results to report.[/dim]")
        return

    table = Table(title="Ingestion Summary")
    table.add_column("Source", style="cyan")
    table.add_column("Fetched", justify="right")
    table.add_column("Indexed", justify="right", style="green")
    table.add_column("Skipped", justify="right", style="yellow")
    table.add_column("Errors", justify="right", style="red")
    table.add_column("Time", justify="right")

    total_fetched = 0
    total_indexed = 0
    total_skipped = 0
    total_errors = 0
    total_time = 0.0

    for result in all_results:
        table.add_row(
            result.source_name,
            str(result.total_fetched),
            str(result.indexed),
            str(result.skipped),
            str(result.errors),
            f"{result.elapsed_seconds:.1f}s",
        )
        total_fetched += result.total_fetched
        total_indexed += result.indexed
        total_skipped += result.skipped
        total_errors += result.errors
        total_time += result.elapsed_seconds

    table.add_section()
    table.add_row(
        "[bold]TOTAL[/bold]",
        str(total_fetched),
        str(total_indexed),
        str(total_skipped),
        str(total_errors),
        f"{total_time:.1f}s",
    )

    console.print(f"\n")
    console.print(table)


@click.command()
@click.option("--all", "ingest_all", is_flag=True, help="Ingest all tiers.")
@click.option("--tier", type=int, help="Ingest a specific tier (1-5).")
@click.option("--source", type=str, help="Ingest a specific source by repo or URL.")
@click.option("--dry-run", is_flag=True, help="Preview what would be ingested without actually indexing.")
@click.option("--force", is_flag=True, help="Re-ingest all content, ignoring content hash.")
@click.option("--log-level", default="INFO", help="Log level (DEBUG, INFO, WARNING, ERROR).")
def main(
    ingest_all: bool,
    tier: int,
    source: str,
    dry_run: bool,
    force: bool,
    log_level: str,
) -> None:
    """EDOT Assistant — Ingestion Orchestrator."""
    logging.basicConfig(level=getattr(logging, log_level.upper()))
    console.print("[bold blue]EDOT Assistant — Ingestion Orchestrator[/bold blue]")

    if dry_run:
        console.print("[yellow]DRY RUN MODE — no documents will be indexed.[/yellow]")

    if not any([ingest_all, tier, source]):
        console.print("[red]Specify --all, --tier, or --source.[/red]")
        sys.exit(1)

    es = get_es_client()

    try:
        info = es.info()
        console.print(f"Connected to Elasticsearch {info['version']['number']}")
    except Exception as e:
        console.print(f"[red]Cannot connect to Elasticsearch:[/red] {e}")
        sys.exit(1)

    sources_config = load_sources()
    all_results = []
    start_time = time.time()

    if source:
        results = ingest_source(es, source, sources_config, dry_run, force)
        all_results.extend(results)
    elif tier:
        if tier < 1 or tier > 5:
            console.print("[red]Tier must be between 1 and 5.[/red]")
            sys.exit(1)
        results = ingest_tier(es, tier, sources_config, dry_run, force)
        all_results.extend(results)
    elif ingest_all:
        for t in range(1, 6):
            results = ingest_tier(es, t, sources_config, dry_run, force)
            all_results.extend(results)

    # Print summary
    print_summary(all_results)

    total_time = time.time() - start_time
    console.print(f"\n[bold]Total elapsed time:[/bold] {total_time:.1f}s")


if __name__ == "__main__":
    main()
