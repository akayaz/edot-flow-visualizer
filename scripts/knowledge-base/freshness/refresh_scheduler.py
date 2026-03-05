"""Automated refresh scheduler for the EDOT Assistant knowledge base.

Runs ingestion pipelines and freshness updates on configurable schedules.
Can be run as a long-running process or individual cron jobs.

Usage:
    # Long-running scheduler
    python -m freshness.refresh_scheduler

    # Single run of a specific task
    python -m freshness.refresh_scheduler --run-once tier1
"""

import logging
import os
import subprocess
import sys
import time
from datetime import datetime

import click
import schedule
from dotenv import load_dotenv
from rich.console import Console

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

SCRIPTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run_module(module: str, args: list[str] | None = None) -> bool:
    """Run a Python module as a subprocess."""
    cmd = [sys.executable, "-m", module] + (args or [])
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    console.print(f"\n[dim]{timestamp}[/dim] [bold]Running:[/bold] python -m {module} {' '.join(args or [])}")

    try:
        result = subprocess.run(
            cmd,
            cwd=SCRIPTS_DIR,
            capture_output=True,
            text=True,
            timeout=3600,  # 1 hour timeout per task
        )
        if result.returncode == 0:
            console.print(f"  [green]Completed successfully.[/green]")
            return True
        else:
            console.print(f"  [red]Failed (exit code {result.returncode}).[/red]")
            if result.stderr:
                console.print(f"  [dim]{result.stderr[:500]}[/dim]")
            return False
    except subprocess.TimeoutExpired:
        console.print(f"  [red]Timed out after 1 hour.[/red]")
        return False
    except Exception as e:
        console.print(f"  [red]Error: {e}[/red]")
        return False


# ─── Scheduled tasks ─────────────────────────────────────────────

def ingest_tier_1() -> None:
    """Ingest Tier 1 (Elastic EDOT docs) — every 3 days."""
    run_module("ingest.run_ingestion", ["--tier", "1"])


def ingest_tiers_2_3() -> None:
    """Ingest Tiers 2-3 (GitHub supplements + OTel web docs) — weekly."""
    run_module("ingest.run_ingestion", ["--tier", "2"])
    run_module("ingest.run_ingestion", ["--tier", "3"])


def ingest_tiers_4_5() -> None:
    """Ingest Tiers 4-5 (blogs + community) — bi-weekly."""
    run_module("ingest.run_ingestion", ["--tier", "4"])
    run_module("ingest.run_ingestion", ["--tier", "5"])


def update_freshness() -> None:
    """Recalculate freshness scores — daily."""
    run_module("freshness.freshness_scorer")


def check_staleness() -> None:
    """Check for stale documents — daily."""
    run_module("freshness.staleness_checker")


# ─── Schedule configuration ──────────────────────────────────────

SCHEDULES = {
    "tier1": {
        "description": "Tier 1 (EDOT docs) — every 3 days",
        "setup": lambda: schedule.every(3).days.at("02:00").do(ingest_tier_1),
        "run_once": ingest_tier_1,
    },
    "tiers23": {
        "description": "Tiers 2-3 (GitHub + OTel) — every Sunday",
        "setup": lambda: schedule.every().sunday.at("03:00").do(ingest_tiers_2_3),
        "run_once": ingest_tiers_2_3,
    },
    "tiers45": {
        "description": "Tiers 4-5 (blogs + community) — bi-weekly",
        "setup": lambda: schedule.every(2).weeks.do(ingest_tiers_4_5),
        "run_once": ingest_tiers_4_5,
    },
    "freshness": {
        "description": "Freshness score update — daily",
        "setup": lambda: schedule.every().day.at("06:00").do(update_freshness),
        "run_once": update_freshness,
    },
    "staleness": {
        "description": "Staleness check — daily",
        "setup": lambda: schedule.every().day.at("06:30").do(check_staleness),
        "run_once": check_staleness,
    },
}


@click.command()
@click.option("--run-once", type=click.Choice(list(SCHEDULES.keys())), help="Run a single task and exit.")
@click.option("--list-schedules", is_flag=True, help="Show all scheduled tasks.")
def main(run_once: str | None, list_schedules: bool) -> None:
    """Run the EDOT Assistant refresh scheduler."""
    console.print("[bold blue]EDOT Assistant — Refresh Scheduler[/bold blue]")

    if list_schedules:
        console.print("\n[bold]Scheduled Tasks:[/bold]")
        for key, config in SCHEDULES.items():
            console.print(f"  [cyan]{key}[/cyan]: {config['description']}")
        return

    if run_once:
        task = SCHEDULES.get(run_once)
        if task:
            console.print(f"\nRunning: {task['description']}")
            task["run_once"]()
        else:
            console.print(f"[red]Unknown task: {run_once}[/red]")
        return

    # Set up all schedules
    console.print("\n[bold]Setting up schedules...[/bold]")
    for key, config in SCHEDULES.items():
        config["setup"]()
        console.print(f"  [green]Scheduled:[/green] {config['description']}")

    console.print(f"\n[bold]Scheduler running.[/bold] Press Ctrl+C to stop.")
    console.print(f"[dim]Note: Elastic GitHub connector runs its own sync schedule (configured in Kibana).[/dim]")

    try:
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    except KeyboardInterrupt:
        console.print("\n[yellow]Scheduler stopped.[/yellow]")


if __name__ == "__main__":
    main()
