"""Set up Elastic GitHub connectors for the EDOT Assistant knowledge base.

Creates two GitHub connectors via the Elasticsearch Connector API:
1. EDOT repos (elastic org) — markdown docs, issues, PRs
2. OTel repos (open-telemetry org) — markdown docs, issues, PRs

The connectors are deployed as a self-managed Docker container that syncs
GitHub content directly into the edot-kb-github index.

Usage:
    python -m connectors.github_connector_setup
"""

import json
import os
import sys
import logging
import subprocess
import time
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
CONNECTOR_IMAGE = "docker.elastic.co/integrations/elastic-connectors:9.3.2"
SYNC_CONTAINER_NAME = "edot-kb-connectors-sync"

CONNECTORS = [
    {
        "connector_id": "edot-github-connector",
        "index_name": "edot-kb-github",
        "name": "EDOT GitHub Repos",
        "config_file": "edot_repos.json",
    },
    {
        "connector_id": "otel-github-connector",
        "index_name": "edot-kb-github",
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


def connector_request(
    es: Elasticsearch,
    method: str,
    path: str,
    body: dict | None = None,
) -> dict:
    """Call Connector API with explicit JSON headers."""
    return es.perform_request(
        method=method,
        path=path,
        body=body,
        headers={"Content-Type": "application/json"},
    )


def generate_connector_configs() -> None:
    """Generate connector config JSON files from sources.yaml."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
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
        connector_request(es, "GET", f"/_connector/{connector_id}")
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
    if not github_token:
        console.print("  [red]GITHUB_TOKEN is required to configure connector.[/red]")
        return False
    if config.get("token") == "${GITHUB_TOKEN}":
        config["token"] = github_token

    try:
        body = {
            "index_name": index_name,
            "name": name,
            "service_type": "github",
        }
        connector_request(es, "PUT", f"/_connector/{connector_id}", body=body)
        console.print(f"  [green]Connector created.[/green]")

        # Update configuration
        connector_request(
            es,
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
        connector_request(
            es,
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
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    es_url = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
    es_api_key = os.environ.get("ELASTICSEARCH_API_KEY", "")

    config = f"""# Auto-generated connector service configuration
# Run with: docker run -v $(pwd)/config:/config {CONNECTOR_IMAGE}

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
        f"  docker run -v {CONFIG_DIR}:/config \\\n"
        f"    {CONNECTOR_IMAGE} \\\n"
        "    /app/bin/elastic-ingest -c /config/docker_config.yml"
    )


def _extract_sync_state(connector_info: dict) -> str:
    """Extract best-effort connector sync state from API payload."""
    for key in ("last_sync_status", "sync_status", "status"):
        value = connector_info.get(key)
        if isinstance(value, str):
            return value.lower()
        if isinstance(value, dict):
            nested = value.get("status")
            if isinstance(nested, str):
                return nested.lower()
    return "unknown"


def run_initial_sync(
    es: Elasticsearch,
    timeout_seconds: int = 900,
    poll_seconds: int = 15,
) -> bool:
    """Run connector service once and wait for initial sync."""
    config_path = CONFIG_DIR / "docker_config.yml"
    if not config_path.exists():
        console.print(
            f"[red]Docker config missing:[/red] {config_path}. Run setup first."
        )
        return False

    try:
        start_count = es.count(index="edot-kb-github").get("count", 0)
    except Exception:
        start_count = 0

    subprocess.run(
        ["docker", "rm", "-f", SYNC_CONTAINER_NAME],
        check=False,
        capture_output=True,
        text=True,
    )

    cmd = [
        "docker",
        "run",
        "-d",
        "--name",
        SYNC_CONTAINER_NAME,
        "-v",
        f"{CONFIG_DIR}:/config",
        CONNECTOR_IMAGE,
        "/app/bin/elastic-ingest",
        "-c",
        "/config/docker_config.yml",
    ]
    console.print("\n[bold]Starting connector service for initial sync...[/bold]")
    try:
        start = subprocess.run(cmd, check=False, capture_output=True, text=True)
    except Exception as e:
        console.print(f"[red]Failed to start connector container:[/red] {e}")
        return False

    if start.returncode != 0:
        console.print(f"[red]Docker run failed:[/red] {start.stderr.strip()}")
        return False

    deadline = time.time() + timeout_seconds
    success = False
    try:
        while time.time() < deadline:
            states: list[str] = []
            completed = 0
            failed = False
            for conn in CONNECTORS:
                try:
                    info = connector_request(es, "GET", f"/_connector/{conn['connector_id']}")
                    state = _extract_sync_state(info)
                    states.append(f"{conn['connector_id']}={state}")
                    if state in {"completed", "success"}:
                        completed += 1
                    if state in {"error", "failed", "cancelled"}:
                        failed = True
                except Exception:
                    states.append(f"{conn['connector_id']}=unknown")

            try:
                current_count = es.count(index="edot-kb-github").get("count", 0)
            except Exception:
                current_count = start_count

            console.print(
                "  [dim]Sync status:[/dim] "
                + ", ".join(states)
                + f" | docs={current_count}"
            )

            if completed == len(CONNECTORS) and completed > 0:
                success = True
                break
            if current_count > start_count:
                success = True
                break
            if failed:
                break

            time.sleep(poll_seconds)
    finally:
        subprocess.run(
            ["docker", "stop", SYNC_CONTAINER_NAME],
            check=False,
            capture_output=True,
            text=True,
        )
        subprocess.run(
            ["docker", "rm", SYNC_CONTAINER_NAME],
            check=False,
            capture_output=True,
            text=True,
        )

    if success:
        console.print("[green]Initial connector sync completed.[/green]")
    else:
        console.print("[yellow]Initial sync did not complete before timeout.[/yellow]")
    return success


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
            info = connector_request(es, "GET", f"/_connector/{conn['connector_id']}")
            status = _extract_sync_state(info)
            color = "green" if status in {"configured", "connected", "completed"} else "yellow"
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
@click.option(
    "--run-sync",
    is_flag=True,
    help="Start connector Docker service, wait for initial sync, then stop.",
)
def main(verify_only: bool, generate_configs: bool, run_sync: bool) -> None:
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

    sync_ok = True
    if run_sync:
        sync_ok = run_initial_sync(es)

    success = sum(1 for _, ok in results if ok)
    total = len(results)
    if success == total and sync_ok:
        if run_sync:
            console.print(f"\n[green]All {total} connectors created and synced successfully.[/green]")
        else:
            console.print(f"\n[green]All {total} connectors created successfully.[/green]")
    else:
        if run_sync and not sync_ok:
            console.print(
                f"\n[yellow]{success}/{total} connectors created, "
                "but initial sync was incomplete.[/yellow]"
            )
        else:
            console.print(f"\n[yellow]{success}/{total} connectors created.[/yellow]")


if __name__ == "__main__":
    main()
