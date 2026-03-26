"""Ingestion orchestrator for the EDOT Assistant knowledge base.

This orchestrator now focuses on GitHub supplementary ingestion and can
optionally trigger Open Web Crawler runs for docs/blog content.

Usage:
    python -m ingest.run_ingestion --all
    python -m ingest.run_ingestion --tier 2
    python -m ingest.run_ingestion --source "elastic/opentelemetry"
    python -m ingest.run_ingestion --run-crawlers
    python -m ingest.run_ingestion --run-connector --all
"""

import logging
import os
import subprocess
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
from ingest.github_supplements import GitHubSupplementIngestor

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

SOURCES_FILE = Path(__file__).parent.parent / "config" / "sources.yaml"

GITHUB_TIERS = {"tier_2", "tier_3"}
CRAWLER_SCRIPT = Path(__file__).parent.parent / "scripts" / "run_crawler.sh"
GITHUB_INDEX = "edot-kb-github"


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


def run_crawlers(configs: list[str], dry_run: bool = False) -> bool:
    """Launch crawler runs through the helper shell script."""
    if not CRAWLER_SCRIPT.exists():
        console.print(
            f"[red]Crawler helper script not found:[/red] {CRAWLER_SCRIPT}"
        )
        return False

    cmd = ["bash", str(CRAWLER_SCRIPT)]
    for config_name in configs:
        cmd.extend(["--config", config_name])
    if dry_run:
        cmd.append("--dry-run")

    console.print(
        "\n[bold cyan]Running crawler helper:[/bold cyan] "
        + " ".join(cmd)
    )
    try:
        result = subprocess.run(
            cmd,
            cwd=str(Path(__file__).parent.parent),
            check=False,
            capture_output=False,
            text=True,
        )
        return result.returncode == 0
    except Exception as e:
        console.print(f"[red]Crawler helper failed:[/red] {e}")
        return False


def run_connector_sync(dry_run: bool = False) -> bool:
    """Run connector setup and one initial sync before supplements."""
    cmd = [sys.executable, "-m", "connectors.github_connector_setup", "--run-sync"]
    console.print(
        "\n[bold cyan]Running GitHub connector setup:[/bold cyan] "
        + " ".join(cmd)
    )
    if dry_run:
        console.print("[yellow]DRY RUN: Skipping connector execution.[/yellow]")
        return True

    try:
        result = subprocess.run(
            cmd,
            cwd=str(Path(__file__).parent.parent),
            check=False,
            capture_output=False,
            text=True,
        )
        return result.returncode == 0
    except Exception as e:
        console.print(f"[red]Connector setup failed:[/red] {e}")
        return False


def get_repo_sources(sources: list[dict]) -> list[dict]:
    """Return only repository-based sources."""
    return [s for s in sources if "repo" in s]


def ingest_github_tier(
    es: Elasticsearch,
    tier_key: str,
    sources: list[dict],
    dry_run: bool = False,
    force: bool = False,
) -> list[IngestResult]:
    """Run GitHub supplements ingestion for a tier's repo sources."""
    repo_sources = get_repo_sources(sources)

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
    """Ingest all GitHub sources in a given tier."""
    tier_key = f"tier_{tier_num}"
    if tier_key not in GITHUB_TIERS:
        console.print(
            f"[yellow]{tier_key} contains crawler sources only. "
            "Use --run-crawlers for web docs/blogs.[/yellow]"
        )
        return []

    tier_sources = sources_config.get("sources", {}).get(tier_key, [])

    if not tier_sources:
        console.print(f"[yellow]No sources found for {tier_key}.[/yellow]")
        return []

    console.print(f"\n[bold cyan]Processing {tier_key} ({len(tier_sources)} sources)[/bold cyan]")

    results = []

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
    """Ingest a specific GitHub source by repo name or source name."""
    results = []

    for tier_key in sorted(GITHUB_TIERS):
        tier_sources = sources_config.get("sources", {}).get(tier_key, [])
        for source in tier_sources:
            matched = (
                source.get("repo") == source_id
                or source.get("name") == source_id
            )
            if not matched:
                continue

            console.print(f"\n[bold cyan]Found source in {tier_key}:[/bold cyan] {source.get('name', source_id)}")

            ingestor = GitHubSupplementIngestor(
                es_client=es,
                index_name=GITHUB_INDEX,
                source_tier=tier_key,
                dry_run=dry_run,
            )
            result = ingestor.ingest_repo(source, force=force)
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
@click.option("--all", "ingest_all", is_flag=True, help="Ingest all GitHub tiers (2 and 3).")
@click.option("--tier", type=int, help="Ingest a specific GitHub tier (2 or 3).")
@click.option("--source", type=str, help="Ingest a specific GitHub source by repo or source name.")
@click.option(
    "--run-crawlers",
    "run_crawlers_flag",
    is_flag=True,
    help="Run the crawler helper for web docs/blogs.",
)
@click.option(
    "--run-connector",
    "run_connector_flag",
    is_flag=True,
    help="Run GitHub connector setup and initial sync before supplements.",
)
@click.option(
    "--crawler-config",
    "crawler_configs",
    multiple=True,
    help="Crawler config filename to run (repeatable). Default: run all crawler configs.",
)
@click.option("--dry-run", is_flag=True, help="Preview what would be ingested without actually indexing.")
@click.option("--force", is_flag=True, help="Re-ingest all content, ignoring content hash.")
@click.option("--log-level", default="INFO", help="Log level (DEBUG, INFO, WARNING, ERROR).")
def main(
    ingest_all: bool,
    tier: int,
    source: str,
    run_crawlers_flag: bool,
    run_connector_flag: bool,
    crawler_configs: tuple[str, ...],
    dry_run: bool,
    force: bool,
    log_level: str,
) -> None:
    """EDOT Assistant — Ingestion Orchestrator."""
    logging.basicConfig(level=getattr(logging, log_level.upper()))
    console.print("[bold blue]EDOT Assistant — Ingestion Orchestrator[/bold blue]")

    if dry_run:
        console.print("[yellow]DRY RUN MODE — no documents will be indexed.[/yellow]")

    if not any([ingest_all, tier, source, run_crawlers_flag, run_connector_flag]):
        console.print(
            "[red]Specify at least one mode: --all, --tier, --source, "
            "--run-crawlers, or --run-connector.[/red]"
        )
        sys.exit(1)

    sources_config = load_sources()
    all_results: list[IngestResult] = []
    start_time = time.time()
    had_error = False

    if run_connector_flag:
        connector_ok = run_connector_sync(dry_run=dry_run)
        if not connector_ok:
            had_error = True

    if run_crawlers_flag:
        selected_configs = list(crawler_configs) if crawler_configs else []
        crawlers_ok = run_crawlers(selected_configs, dry_run=dry_run)
        if not crawlers_ok:
            had_error = True

    needs_es = any([ingest_all, tier is not None, bool(source)])
    if needs_es:
        es = get_es_client()
        try:
            info = es.info()
            console.print(f"Connected to Elasticsearch {info['version']['number']}")
        except Exception as e:
            console.print(f"[red]Cannot connect to Elasticsearch:[/red] {e}")
            sys.exit(1)

        if source:
            results = ingest_source(es, source, sources_config, dry_run, force)
            all_results.extend(results)
        elif tier:
            if tier not in (2, 3):
                console.print("[red]Tier must be 2 or 3 for GitHub ingestion.[/red]")
                sys.exit(1)
            results = ingest_tier(es, tier, sources_config, dry_run, force)
            all_results.extend(results)
        elif ingest_all:
            for t in [2, 3]:
                results = ingest_tier(es, t, sources_config, dry_run, force)
                all_results.extend(results)

    # Print summary
    if all_results:
        print_summary(all_results)

    total_time = time.time() - start_time
    console.print(f"\n[bold]Total elapsed time:[/bold] {total_time:.1f}s")
    if had_error:
        sys.exit(1)


if __name__ == "__main__":
    main()
