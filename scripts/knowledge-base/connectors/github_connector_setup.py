"""Set up Elastic GitHub connectors for the EDOT Assistant knowledge base.

Creates two GitHub connectors via the Elasticsearch Connector API:
1. EDOT repos (elastic org) — markdown docs, issues, PRs
2. OTel repos (open-telemetry org) — markdown docs, issues, PRs

The connectors are deployed as a self-managed Docker container that syncs
GitHub content directly into the edot-assistant-github-repos index.

Usage:
    python -m connectors.github_connector_setup
"""

import json
import os
import sys
import logging
from pathlib import Path

import click
import yaml
from dotenv import load_dotenv
from elasticsearch import Elasticsearch, NotFoundError
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).parent / "connector_configs"
SOURCES_FILE = Path(__file__).parent.parent / "config" / "sources.yaml"

CONNECTORS = [
    {
        "connector_id": "edot-github-connector",
        "index_name": "edot-assistant-github-repos",
        "name": "EDOT GitHub Repos",
        "config_file": "edot_repos.json",
    },
    {
        "connector_id": "otel-github-connector",
        "index_name": "edot-assistant-github-repos",
        "name": "OTel GitHub Repos",
        "config_file": "otel_repos.json",
    },
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


def load_sources_yaml() -> dict:
    """Load the sources.yaml configuration."""
    with open(SOURCES_FILE, "r") as f:
        return yaml.safe_load(f)


def generate_connector_configs() -> None:
    """Generate connector config JSON files from sources.yaml."""
    sources = load_sources_yaml()
    github_config = sources.get("github_connector", {})

    # EDOT repos connector config
    edot_config = github_config.get("edot_repos", {})
    edot_repos = edot_config.get("repositories", [])
    edot_connector = {
        "data_source": "github_cloud",
        "auth_method": "personal_access_token",
        "token": "${GITHUB_TOKEN}",
        "repo_type": "organization",
        "org_name": edot_config.get("org_name", "elastic"),
        "repositories": ",".join(edot_repos),
        "ssl_enabled": False,
        "retry_count": 3,
        "use_text_extraction_service": False,
    }

    edot_path = CONFIG_DIR / "edot_repos.json"
    with open(edot_path, "w") as f:
        json.dump(edot_connector, f, indent=2)
    console.print(f"  Generated: {edot_path}")

    # OTel repos connector config
    otel_config = github_config.get("otel_repos", {})
    otel_repos = otel_config.get("repositories", [])
    otel_connector = {
        "data_source": "github_cloud",
        "auth_method": "personal_access_token",
        "token": "${GITHUB_TOKEN}",
        "repo_type": "other",
        "repositories": ",".join(otel_repos),
        "ssl_enabled": False,
        "retry_count": 3,
        "use_text_extraction_service": False,
    }

    otel_path = CONFIG_DIR / "otel_repos.json"
    with open(otel_path, "w") as f:
        json.dump(otel_connector, f, indent=2)
    console.print(f"  Generated: {otel_path}")


def create_connector(
    es: Elasticsearch,
    connector_id: str,
    index_name: str,
    name: str,
    config_file: str,
) -> bool:
    """Create a single GitHub connector via the Connector API."""
    console.print(f"\n[bold]Creating connector:[/bold] {name} ({connector_id})")

    # Check if connector already exists
    try:
        existing = es.perform_request(
            "GET", f"/_connector/{connector_id}"
        )
        console.print(f"  [yellow]Connector already exists.[/yellow]")
        return True
    except Exception:
        pass

    # Load configuration
    config_path = CONFIG_DIR / config_file
    if not config_path.exists():
        console.print(f"  [red]Config file not found:[/red] {config_path}")
        return False

    with open(config_path, "r") as f:
        config = json.load(f)

    # Replace token placeholder with actual token
    github_token = os.environ.get("GITHUB_TOKEN", "")
    if config.get("token") == "${GITHUB_TOKEN}":
        config["token"] = github_token

    try:
        body = {
            "index_name": index_name,
            "name": name,
            "service_type": "github",
        }
        es.perform_request(
            "PUT",
            f"/_connector/{connector_id}",
            body=body,
        )
        console.print(f"  [green]Connector created.[/green]")

        # Update configuration
        es.perform_request(
            "PUT",
            f"/_connector/{connector_id}/_configuration",
            body={"values": config},
        )
        console.print(f"  [green]Configuration applied.[/green]")

        # Set scheduling (weekly full sync, daily incremental)
        scheduling = {
            "full": {
                "enabled": True,
                "interval": "0 0 * * 0",  # Every Sunday at midnight
            },
            "incremental": {
                "enabled": True,
                "interval": "0 6 * * *",  # Every day at 6 AM
            },
        }
        es.perform_request(
            "PUT",
            f"/_connector/{connector_id}/_scheduling",
            body={"scheduling": scheduling},
        )
        console.print(f"  [green]Scheduling configured.[/green]")

        return True
    except Exception as e:
        console.print(f"  [red]Failed:[/red] {e}")
        return False


def generate_docker_config() -> None:
    """Generate the Docker config.yml for the connector service."""
    es_url = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
    es_api_key = os.environ.get("ELASTICSEARCH_API_KEY", "")

    config = f"""# Auto-generated connector service configuration
# Run with: docker run -v $(pwd)/config:/config docker.elastic.co/integrations/elastic-connectors:9.3.0

elasticsearch:
  host: {es_url}
  api_key: {es_api_key}

connectors:
"""
    for conn in CONNECTORS:
        config += f"""  -
    connector_id: {conn['connector_id']}
    service_type: github
"""

    config_path = CONFIG_DIR / "docker_config.yml"
    with open(config_path, "w") as f:
        f.write(config)
    console.print(f"\n  [green]Docker config generated:[/green] {config_path}")
    console.print(
        "  Run the connector service with:\n"
        "  docker run -v $(pwd)/connector_configs:/config \\\n"
        "    docker.elastic.co/integrations/elastic-connectors:9.3.0 \\\n"
        "    /app/bin/elastic-ingest -c /config/docker_config.yml"
    )


def verify_connectors(es: Elasticsearch) -> None:
    """Verify all connectors exist and show their status."""
    console.print("\n[bold]Connector Status:[/bold]")
    table = Table(title="GitHub Connectors")
    table.add_column("Name", style="cyan")
    table.add_column("ID")
    table.add_column("Index")
    table.add_column("Status", style="bold")

    for conn in CONNECTORS:
        try:
            info = es.perform_request(
                "GET", f"/_connector/{conn['connector_id']}"
            )
            status = info.get("status", "unknown")
            color = "green" if status == "configured" else "yellow"
            table.add_row(
                conn["name"],
                conn["connector_id"],
                conn["index_name"],
                f"[{color}]{status}[/{color}]",
            )
        except Exception:
            table.add_row(
                conn["name"],
                conn["connector_id"],
                conn["index_name"],
                "[red]Not found[/red]",
            )

    console.print(table)


@click.command()
@click.option("--verify-only", is_flag=True, help="Only verify existing connectors.")
@click.option("--generate-configs", is_flag=True, help="Only generate JSON configs from sources.yaml.")
def main(verify_only: bool, generate_configs: bool) -> None:
    """Set up Elastic GitHub connectors for the EDOT Assistant."""
    console.print("[bold blue]EDOT Assistant — GitHub Connector Setup[/bold blue]")

    if generate_configs:
        console.print("\n[bold]Generating connector configs from sources.yaml...[/bold]")
        generate_connector_configs()
        return

    es = get_es_client()

    try:
        info = es.info()
        console.print(f"Connected to Elasticsearch {info['version']['number']}")
    except Exception as e:
        console.print(f"[red]Cannot connect to Elasticsearch:[/red] {e}")
        sys.exit(1)

    if verify_only:
        verify_connectors(es)
        return

    # Generate connector configs
    console.print("\n[bold]Generating connector configs...[/bold]")
    generate_connector_configs()

    # Create connectors
    results = []
    for conn in CONNECTORS:
        ok = create_connector(
            es,
            connector_id=conn["connector_id"],
            index_name=conn["index_name"],
            name=conn["name"],
            config_file=conn["config_file"],
        )
        results.append((conn["name"], ok))

    # Generate Docker config
    generate_docker_config()

    # Verify
    verify_connectors(es)

    success = sum(1 for _, ok in results if ok)
    total = len(results)
    if success == total:
        console.print(f"\n[green]All {total} connectors created successfully.[/green]")
    else:
        console.print(f"\n[yellow]{success}/{total} connectors created.[/yellow]")


if __name__ == "__main__":
    main()
