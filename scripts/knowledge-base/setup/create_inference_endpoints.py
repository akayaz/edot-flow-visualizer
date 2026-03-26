"""Create inference endpoints for EDOT Assistant semantic search.

Deploys:
1. A Jina v5 text embedding endpoint on Elastic Inference Service (EIS)
2. A Jina code embedding endpoint via the `jinaai` service (optional)

Usage:
    python -m setup.create_inference_endpoints
"""

import logging
import os
import sys
from typing import Optional

import click
from dotenv import load_dotenv
from elasticsearch import Elasticsearch, NotFoundError
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

DEFAULT_INFERENCE_ID = "jina-v5-small"
DEFAULT_MODEL_ID = "jina-embeddings-v5-text-small"
CODE_INFERENCE_ID = "jina-code"
CODE_MODEL_ID = "jina-code-embeddings-1.5b"
CODE_DIMENSIONS = 1024
VOYAGE_CODE_MODEL_ID = "voyage-code-3"
FALLBACK_CODE_MODEL_ID = DEFAULT_MODEL_ID
SUPPORTED_MODEL_IDS = {
    "jina-embeddings-v5-text-small",
    "jina-embeddings-v5-text-nano",
    "jina-embeddings-v3",
}


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


def _extract_existing_model_id(endpoint_info: dict) -> Optional[str]:
    """Extract model_id from inference endpoint response."""
    service_settings = endpoint_info.get("service_settings")
    if isinstance(service_settings, dict) and service_settings.get("model_id"):
        return service_settings.get("model_id")

    for value in endpoint_info.values():
        if isinstance(value, dict):
            nested = _extract_existing_model_id(value)
            if nested:
                return nested
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    nested = _extract_existing_model_id(item)
                    if nested:
                        return nested
    return None


def create_or_update_jina_endpoint(
    es: Elasticsearch,
    inference_id: str,
    model_id: str,
) -> bool:
    """Create or update the Jina text embedding endpoint."""
    console.print(
        f"\n[bold]Creating Jina endpoint:[/bold] {inference_id} "
        f"(model: {model_id})"
    )

    try:
        existing = es.inference.get(inference_id=inference_id)
        existing_model_id = _extract_existing_model_id(existing)
        if existing_model_id == model_id:
            console.print(
                "  [yellow]Already exists.[/yellow] "
                f"Model unchanged: {existing_model_id}"
            )
            return True
        console.print(
            "  [yellow]Endpoint exists with a different model.[/yellow] "
            f"Current={existing_model_id or 'unknown'}, New={model_id}"
        )
    except NotFoundError:
        pass

    try:
        es.inference.put(
            inference_id=inference_id,
            task_type="text_embedding",
            body={
                "service": "elastic",
                "service_settings": {
                    "model_id": model_id,
                },
            },
        )
        console.print("  [green]Created/updated successfully.[/green]")
        return True
    except Exception as e:
        console.print(f"  [red]Failed:[/red] {e}")
        return False


def create_or_update_jina_code_endpoint(
    es: Elasticsearch,
    inference_id: str = CODE_INFERENCE_ID,
    model_id: str = CODE_MODEL_ID,
) -> bool:
    """Create code endpoint with compatibility fallbacks."""
    jina_api_key = os.environ.get("JINA_API_KEY")
    voyage_api_key = os.environ.get("VOYAGEAI_API_KEY")

    if jina_api_key:
        console.print(
            f"\n[bold]Creating Jina code endpoint:[/bold] {inference_id} "
            f"(model: {model_id}, dims: {CODE_DIMENSIONS})"
        )
        try:
            es.inference.put(
                inference_id=inference_id,
                task_type="text_embedding",
                body={
                    "service": "jinaai",
                    "service_settings": {
                        "model_id": model_id,
                        "api_key": jina_api_key,
                        "dimensions": CODE_DIMENSIONS,
                    },
                },
            )
            console.print("  [green]Created/updated successfully.[/green]")
            return True
        except Exception as e:
            logger.warning("Failed to create Jina code endpoint: %s", e)
            console.print(f"  [yellow]Jina code endpoint failed:[/yellow] {e}")

    if voyage_api_key:
        console.print(
            f"\n[bold]Trying VoyageAI fallback for code endpoint:[/bold] "
            f"{inference_id} (model: {VOYAGE_CODE_MODEL_ID})"
        )
        try:
            es.inference.put(
                inference_id=inference_id,
                task_type="text_embedding",
                body={
                    "service": "voyageai",
                    "service_settings": {
                        "model_id": VOYAGE_CODE_MODEL_ID,
                        "api_key": voyage_api_key,
                        "dimensions": CODE_DIMENSIONS,
                    },
                },
            )
            console.print("  [green]VoyageAI fallback configured successfully.[/green]")
            return True
        except Exception as e:
            logger.warning("Failed to create Voyage code endpoint: %s", e)
            console.print(f"  [yellow]VoyageAI fallback failed:[/yellow] {e}")

    console.print(
        "\n[yellow]Falling back to text embedding model for code endpoint.[/yellow] "
        "Set JINA_API_KEY and/or VOYAGEAI_API_KEY to enable true code model support."
    )
    try:
        es.inference.put(
            inference_id=inference_id,
            task_type="text_embedding",
            body={
                "service": "elastic",
                "service_settings": {
                    "model_id": FALLBACK_CODE_MODEL_ID,
                },
            },
        )
        console.print(
            "  [green]Fallback code endpoint created using "
            f"{FALLBACK_CODE_MODEL_ID}.[/green]"
        )
        return True
    except Exception as e:
        console.print(f"  [red]Fallback code endpoint failed:[/red] {e}")
        return False


def verify_endpoints(es: Elasticsearch, inference_ids: list[str]) -> None:
    """Verify endpoint existence and configuration."""
    console.print("\n[bold]Verifying inference endpoints...[/bold]")
    table = Table(title="Inference Endpoint")
    table.add_column("Endpoint ID", style="cyan")
    table.add_column("Task Type", style="green")
    table.add_column("Model", style="magenta")
    table.add_column("Status", style="bold")

    for inference_id in inference_ids:
        try:
            info = es.inference.get(inference_id=inference_id)
            task_type = info.get("task_type", "unknown")
            model_id = _extract_existing_model_id(info) or "unknown"
            table.add_row(inference_id, task_type, model_id, "[green]OK[/green]")
        except NotFoundError:
            table.add_row(inference_id, "-", "-", "[yellow]Not deployed[/yellow]")
        except Exception as e:
            table.add_row(inference_id, "-", "-", f"[red]Error: {e}[/red]")

    console.print(table)


@click.command()
@click.option(
    "--inference-id",
    default=DEFAULT_INFERENCE_ID,
    show_default=True,
    help="Inference endpoint id to create/update.",
)
@click.option(
    "--model-id",
    default=DEFAULT_MODEL_ID,
    show_default=True,
    help="EIS model id to attach to this endpoint.",
)
@click.option(
    "--verify-only",
    is_flag=True,
    default=False,
    help="Only verify an existing endpoint without creating/updating.",
)
def main(inference_id: str, model_id: str, verify_only: bool) -> None:
    """Create text/code inference endpoints used by semantic_text fields."""
    console.print("[bold blue]EDOT Assistant — Inference Endpoint Setup[/bold blue]")

    if model_id not in SUPPORTED_MODEL_IDS:
        supported = ", ".join(sorted(SUPPORTED_MODEL_IDS))
        console.print(
            f"[red]Unsupported model_id:[/red] {model_id}\n"
            f"Supported model ids: {supported}"
        )
        sys.exit(1)

    es = get_es_client()

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
        verify_endpoints(es, [inference_id, CODE_INFERENCE_ID])
        return

    if not create_or_update_jina_endpoint(es, inference_id, model_id):
        console.print("\n[red]Inference endpoint setup failed.[/red]")
        sys.exit(1)

    if not create_or_update_jina_code_endpoint(es):
        console.print("\n[red]Code inference endpoint setup failed.[/red]")
        sys.exit(1)

    verify_endpoints(es, [inference_id, CODE_INFERENCE_ID])
    console.print("\n[green]Inference endpoint setup complete.[/green]")


if __name__ == "__main__":
    main()
