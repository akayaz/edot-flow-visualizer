"""Create Elasticsearch indices for the EDOT Assistant knowledge base.

Creates the two consolidated indices:
- edot-kb-docs
- edot-kb-github

Usage:
    python -m setup.create_indices
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

# Index definitions: (mapping_file, index_name)
INDEX_DEFINITIONS = [
    ("docs.json", "edot-kb-docs"),
    ("github.json", "edot-kb-github"),
]

MAPPINGS_DIR = Path(__file__).parent.parent / "config" / "index_mappings"


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


def load_mapping(filename: str) -> dict:
    """Load an index mapping JSON file."""
    mapping_path = MAPPINGS_DIR / filename
    if not mapping_path.exists():
        console.print(f"[red]Mapping file not found:[/red] {mapping_path}")
        sys.exit(1)

    with open(mapping_path, "r") as f:
        return json.load(f)


def create_index(
    es: Elasticsearch,
    mapping_file: str,
    index_name: str,
) -> bool:
    """Create a single index with mapping."""
    console.print(f"\n[bold]Creating index:[/bold] {index_name}")

    # Check if index already exists
    if es.indices.exists(index=index_name):
        console.print(f"  [yellow]Index already exists.[/yellow] Skipping creation.")
        return True

    # Load mapping
    mapping = load_mapping(mapping_file)

    try:
        # Create the index
        es.indices.create(
            index=index_name,
            body=mapping,
        )
        console.print(f"  [green]Index created.[/green]")

        # Verify mapping
        actual_mapping = es.indices.get_mapping(index=index_name)
        properties = (
            actual_mapping.get(index_name, {})
            .get("mappings", {})
            .get("properties", {})
        )
        has_semantic = "body_semantic" in properties
        console.print(
            f"  [dim]Mapping verified: "
            f"{'semantic_text OK' if has_semantic else 'WARNING: no semantic_text field'}"
            f"[/dim]"
        )

        return True
    except Exception as e:
        console.print(f"  [red]Failed:[/red] {e}")
        return False


def verify_indices(es: Elasticsearch) -> None:
    """Verify all indices exist and show their status."""
    console.print("\n[bold]Index Status:[/bold]")
    table = Table(title="EDOT Assistant Indices")
    table.add_column("Index", style="cyan")
    table.add_column("Docs", justify="right")
    table.add_column("Semantic Field", justify="right")
    table.add_column("Status", style="bold")

    for _, index_name in INDEX_DEFINITIONS:
        try:
            if es.indices.exists(index=index_name):
                count_result = es.count(index=index_name)
                doc_count = count_result.get("count", 0)
                mapping = es.indices.get_mapping(index=index_name)
                props = mapping.get(index_name, {}).get("mappings", {}).get("properties", {})
                semantic_ok = "body_semantic" in props
                semantic_field = "yes" if semantic_ok else "no"
                status = "[green]OK[/green]" if semantic_ok else "[yellow]Missing semantic_text[/yellow]"
                table.add_row(index_name, str(doc_count), semantic_field, status)
            else:
                table.add_row(index_name, "-", "-", "[red]Missing[/red]")
        except Exception as e:
            from rich.markup import escape
            table.add_row(index_name, "-", "-", f"[red]{escape(str(e))}[/red]")

    console.print(table)


@click.command()
@click.option(
    "--verify-only",
    is_flag=True,
    default=False,
    help="Only verify existing indices without creating new ones.",
)
@click.option(
    "--delete-existing",
    is_flag=True,
    default=False,
    help="Delete existing indices before recreating. USE WITH CAUTION.",
)
def main(verify_only: bool, delete_existing: bool) -> None:
    """Create Elasticsearch indices for the EDOT Assistant knowledge base."""
    console.print("[bold blue]EDOT Assistant — Index Setup[/bold blue]")

    es = get_es_client()

    # Verify connectivity
    try:
        info = es.info()
        console.print(
            f"Connected to Elasticsearch {info['version']['number']}"
        )
    except Exception as e:
        console.print(f"[red]Cannot connect to Elasticsearch:[/red] {e}")
        sys.exit(1)

    if verify_only:
        verify_indices(es)
        return

    if delete_existing:
        console.print("\n[red bold]Deleting existing indices...[/red bold]")
        for _, index_name in INDEX_DEFINITIONS:
            try:
                if es.indices.exists(index=index_name):
                    es.indices.delete(index=index_name)
                    console.print(f"  Deleted: {index_name}")
            except Exception as e:
                console.print(f"  [red]Error deleting {index_name}:[/red] {e}")

    # Create all indices
    results = []
    for mapping_file, index_name in INDEX_DEFINITIONS:
        ok = create_index(es, mapping_file, index_name)
        results.append((index_name, ok))

    # Verify
    verify_indices(es)

    # Summary
    success = sum(1 for _, ok in results if ok)
    total = len(results)
    if success == total:
        console.print(f"\n[green]All {total} indices created successfully.[/green]")
    else:
        console.print(
            f"\n[yellow]{success}/{total} indices created. "
            f"Check errors above.[/yellow]"
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
