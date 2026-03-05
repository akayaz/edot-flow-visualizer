"""One-command setup for the entire EDOT Assistant knowledge base.

Runs all setup steps in order:
1. Create inference endpoints (ELSER v2)
2. Create Elasticsearch indices
3. Create ingest pipelines
4. Set up GitHub connectors
5. Create Agent Builder agent and tools
6. Verify everything

Usage:
    python -m setup.setup_all
"""

import os
import subprocess
import sys
import logging

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

# Setup steps in order
SETUP_STEPS = [
    {
        "name": "Inference Endpoints",
        "module": "setup.create_inference_endpoints",
        "description": "Deploy ELSER v2 for semantic_text fields",
    },
    {
        "name": "Elasticsearch Indices",
        "module": "setup.create_indices",
        "description": "Create 5 indices with semantic_text mappings and aliases",
    },
    {
        "name": "Ingest Pipelines",
        "module": "setup.create_ingest_pipelines",
        "description": "Register document processing pipelines",
    },
    {
        "name": "GitHub Connectors",
        "module": "connectors.github_connector_setup",
        "description": "Create Elastic GitHub connectors for EDOT and OTel repos",
    },
    {
        "name": "Agent Builder",
        "module": "setup.setup_agent",
        "description": "Create EDOT Assistant agent with tools",
        "extra_args": ["--skip-verify"],
    },
]


def run_step(step: dict, dry_run: bool = False) -> bool:
    """Run a single setup step as a subprocess."""
    name = step["name"]
    module = step["module"]
    description = step["description"]
    extra_args = step.get("extra_args", [])

    console.print(f"\n{'='*60}")
    console.print(f"[bold blue]Step: {name}[/bold blue]")
    console.print(f"[dim]{description}[/dim]")
    console.print(f"{'='*60}")

    if dry_run:
        console.print(f"  [yellow]DRY RUN: Would run python -m {module}[/yellow]")
        return True

    cmd = [sys.executable, "-m", module] + extra_args
    try:
        result = subprocess.run(
            cmd,
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            capture_output=False,
            text=True,
        )
        if result.returncode == 0:
            console.print(f"\n[green]Step '{name}' completed successfully.[/green]")
            return True
        else:
            console.print(f"\n[red]Step '{name}' failed with exit code {result.returncode}.[/red]")
            return False
    except Exception as e:
        console.print(f"\n[red]Step '{name}' error: {e}[/red]")
        return False


@click.command()
@click.option("--dry-run", is_flag=True, help="Preview steps without executing.")
@click.option("--skip-agent", is_flag=True, help="Skip Agent Builder setup (requires Agent Builder access).")
@click.option("--continue-on-error", is_flag=True, help="Continue even if a step fails.")
def main(dry_run: bool, skip_agent: bool, continue_on_error: bool) -> None:
    """Run the complete EDOT Assistant knowledge base setup."""
    console.print(Panel(
        "[bold blue]EDOT Assistant — Full Setup[/bold blue]\n\n"
        "This will set up the complete knowledge base infrastructure:\n"
        "  1. Inference endpoints (ELSER v2)\n"
        "  2. Elasticsearch indices (5 indices with semantic_text)\n"
        "  3. Ingest pipelines\n"
        "  4. GitHub connectors (Elastic + OTel repos)\n"
        "  5. Agent Builder agent + tools",
        title="Setup",
        border_style="blue",
    ))

    if dry_run:
        console.print("\n[yellow]DRY RUN MODE — no changes will be made.[/yellow]")

    # Validate environment
    required_vars = ["ELASTICSEARCH_URL", "ELASTICSEARCH_API_KEY"]
    if not skip_agent:
        required_vars.extend(["AGENT_BUILDER_URL", "AGENT_BUILDER_API_KEY"])

    missing = [v for v in required_vars if not os.environ.get(v)]
    if missing:
        console.print(f"\n[red]Missing environment variables:[/red] {', '.join(missing)}")
        console.print("Set these in your .env file or environment.")
        sys.exit(1)

    # Run steps
    steps = SETUP_STEPS.copy()
    if skip_agent:
        steps = [s for s in steps if s["name"] != "Agent Builder"]

    results = []
    for step in steps:
        ok = run_step(step, dry_run=dry_run)
        results.append((step["name"], ok))
        if not ok and not continue_on_error:
            console.print("\n[red]Setup aborted due to error. Use --continue-on-error to skip failed steps.[/red]")
            sys.exit(1)

    # Summary
    console.print(f"\n{'='*60}")
    console.print("[bold]Setup Summary[/bold]")
    console.print(f"{'='*60}")

    for name, ok in results:
        status = "[green]OK[/green]" if ok else "[red]FAILED[/red]"
        console.print(f"  {name}: {status}")

    success = sum(1 for _, ok in results if ok)
    total = len(results)

    if success == total:
        console.print(f"\n[green bold]All {total} steps completed successfully![/green bold]")
        console.print("\nNext steps:")
        console.print("  1. Run initial ingestion: python -m ingest.run_ingestion --tier 1")
        console.print("  2. Start the connector service Docker container")
        console.print("  3. Start the refresh scheduler: python -m freshness.refresh_scheduler")
    else:
        console.print(f"\n[yellow]{success}/{total} steps completed. Review errors above.[/yellow]")
        sys.exit(1)


if __name__ == "__main__":
    main()
