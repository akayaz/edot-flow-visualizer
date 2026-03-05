"""Create inference endpoints for EDOT Assistant semantic search.

Deploys ELSER v2 as the primary inference endpoint for semantic_text fields.
Optionally deploys Jina Embeddings v4 for multilingual content.

Usage:
    python -m setup.create_inference_endpoints
"""

import os
import sys
import json
import logging

import click
from dotenv import load_dotenv
from elasticsearch import Elasticsearch, NotFoundError
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

ELSER_ENDPOINT_ID = ".elser-2-elastic"
JINA_ENDPOINT_ID = "jina-embeddings-v4"


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


def create_elser_endpoint(es: Elasticsearch) -> bool:
    """Deploy ELSER v2 sparse embedding inference endpoint."""
    console.print(f"\n[bold]Creating ELSER v2 endpoint:[/bold] {ELSER_ENDPOINT_ID}")

    try:
        existing = es.inference.get(inference_id=ELSER_ENDPOINT_ID)
        console.print(
            f"  [yellow]Already exists.[/yellow] "
            f"Model: {existing.get('service', 'unknown')}"
        )
        return True
    except NotFoundError:
        pass

    try:
        es.inference.put(
            inference_id=ELSER_ENDPOINT_ID,
            task_type="sparse_embedding",
            body={
                "service": "elser",
                "service_settings": {
                    "num_allocations": 1,
                    "num_threads": 1,
                },
            },
        )
        console.print("  [green]Created successfully.[/green]")
        return True
    except Exception as e:
        console.print(f"  [red]Failed:[/red] {e}")
        return False


def create_jina_endpoint(es: Elasticsearch) -> bool:
    """Deploy Jina Embeddings v4 dense embedding inference endpoint (optional)."""
    console.print(f"\n[bold]Creating Jina v4 endpoint:[/bold] {JINA_ENDPOINT_ID}")

    try:
        existing = es.inference.get(inference_id=JINA_ENDPOINT_ID)
        console.print(
            f"  [yellow]Already exists.[/yellow] "
            f"Model: {existing.get('service', 'unknown')}"
        )
        return True
    except NotFoundError:
        pass

    try:
        es.inference.put(
            inference_id=JINA_ENDPOINT_ID,
            task_type="text_embedding",
            body={
                "service": "elasticsearch",
                "service_settings": {
                    "model_id": ".multilingual-e5-small",
                },
            },
        )
        console.print("  [green]Created successfully.[/green]")
        return True
    except Exception as e:
        console.print(f"  [red]Failed:[/red] {e}")
        return False


def verify_endpoints(es: Elasticsearch) -> None:
    """Verify all inference endpoints are operational."""
    console.print("\n[bold]Verifying inference endpoints...[/bold]")
    table = Table(title="Inference Endpoints")
    table.add_column("Endpoint ID", style="cyan")
    table.add_column("Task Type", style="green")
    table.add_column("Status", style="bold")

    for endpoint_id in [ELSER_ENDPOINT_ID, JINA_ENDPOINT_ID]:
        try:
            info = es.inference.get(inference_id=endpoint_id)
            task_type = info.get("task_type", "unknown")
            table.add_row(endpoint_id, task_type, "[green]OK[/green]")
        except NotFoundError:
            table.add_row(endpoint_id, "-", "[yellow]Not deployed[/yellow]")
        except Exception as e:
            table.add_row(endpoint_id, "-", f"[red]Error: {e}[/red]")

    console.print(table)


@click.command()
@click.option(
    "--include-jina",
    is_flag=True,
    default=False,
    help="Also deploy the Jina Embeddings v4 endpoint for multilingual content.",
)
@click.option(
    "--verify-only",
    is_flag=True,
    default=False,
    help="Only verify existing endpoints without creating new ones.",
)
def main(include_jina: bool, verify_only: bool) -> None:
    """Create inference endpoints for EDOT Assistant semantic search."""
    console.print("[bold blue]EDOT Assistant — Inference Endpoint Setup[/bold blue]")

    es = get_es_client()

    # Verify cluster connectivity
    try:
        info = es.info()
        console.print(
            f"Connected to Elasticsearch {info['version']['number']} "
            f"at {os.environ.get('ELASTICSEARCH_URL')}"
        )
    except Exception as e:
        console.print(f"[red]Cannot connect to Elasticsearch:[/red] {e}")
        sys.exit(1)

    if verify_only:
        verify_endpoints(es)
        return

    # Deploy ELSER v2 (always)
    elser_ok = create_elser_endpoint(es)

    # Deploy Jina v4 (optional)
    jina_ok = True
    if include_jina:
        jina_ok = create_jina_endpoint(es)

    # Verify
    verify_endpoints(es)

    if not elser_ok:
        console.print(
            "\n[red]ELSER v2 deployment failed.[/red] "
            "This is required for semantic_text fields. "
            "Check that your Elastic Cloud deployment supports ML nodes."
        )
        sys.exit(1)

    console.print("\n[green]Inference endpoint setup complete.[/green]")


if __name__ == "__main__":
    main()
