"""Create Elasticsearch ingest pipelines for the EDOT Assistant.

Registers document processing pipelines that handle metadata enrichment,
freshness scoring, and tag normalization.

Usage:
    python -m setup.create_ingest_pipelines
"""

import json
import os
import sys
import logging
from pathlib import Path

import click
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

PIPELINES_DIR = Path(__file__).parent.parent / "config" / "ingest_pipelines"

# Pipeline definitions: (filename, pipeline_id)
PIPELINE_DEFINITIONS = [
    ("chunking_pipeline.json", "edot-assistant-processing"),
    ("metadata_enrichment.json", "edot-assistant-metadata"),
]


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


def create_pipeline(
    es: Elasticsearch, filename: str, pipeline_id: str
) -> bool:
    """Create or update a single ingest pipeline."""
    console.print(f"\n[bold]Creating pipeline:[/bold] {pipeline_id}")

    pipeline_path = PIPELINES_DIR / filename
    if not pipeline_path.exists():
        console.print(f"  [red]Pipeline file not found:[/red] {pipeline_path}")
        return False

    with open(pipeline_path, "r") as f:
        pipeline_body = json.load(f)

    try:
        es.ingest.put_pipeline(id=pipeline_id, body=pipeline_body)
        console.print(f"  [green]Created/updated successfully.[/green]")
        return True
    except Exception as e:
        console.print(f"  [red]Failed:[/red] {e}")
        return False


def verify_pipelines(es: Elasticsearch) -> None:
    """Verify all pipelines exist."""
    console.print("\n[bold]Pipeline Status:[/bold]")
    table = Table(title="Ingest Pipelines")
    table.add_column("Pipeline ID", style="cyan")
    table.add_column("Description")
    table.add_column("Processors", justify="right")
    table.add_column("Status", style="bold")

    for _, pipeline_id in PIPELINE_DEFINITIONS:
        try:
            pipeline = es.ingest.get_pipeline(id=pipeline_id)
            info = pipeline.get(pipeline_id, {})
            desc = info.get("description", "-")
            proc_count = len(info.get("processors", []))
            table.add_row(pipeline_id, desc, str(proc_count), "[green]OK[/green]")
        except Exception:
            table.add_row(pipeline_id, "-", "-", "[red]Missing[/red]")

    console.print(table)


@click.command()
@click.option(
    "--verify-only",
    is_flag=True,
    default=False,
    help="Only verify existing pipelines.",
)
def main(verify_only: bool) -> None:
    """Create Elasticsearch ingest pipelines for the EDOT Assistant."""
    console.print("[bold blue]EDOT Assistant — Ingest Pipeline Setup[/bold blue]")

    es = get_es_client()

    try:
        info = es.info()
        console.print(f"Connected to Elasticsearch {info['version']['number']}")
    except Exception as e:
        console.print(f"[red]Cannot connect to Elasticsearch:[/red] {e}")
        sys.exit(1)

    if verify_only:
        verify_pipelines(es)
        return

    results = []
    for filename, pipeline_id in PIPELINE_DEFINITIONS:
        ok = create_pipeline(es, filename, pipeline_id)
        results.append((pipeline_id, ok))

    verify_pipelines(es)

    success = sum(1 for _, ok in results if ok)
    total = len(results)
    if success == total:
        console.print(f"\n[green]All {total} pipelines created successfully.[/green]")
    else:
        console.print(f"\n[yellow]{success}/{total} pipelines created.[/yellow]")
        sys.exit(1)


if __name__ == "__main__":
    main()
