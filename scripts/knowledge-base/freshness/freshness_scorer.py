"""Batch freshness score updater for all EDOT Assistant indices.

Recalculates freshness_score for all documents based on their source_tier
and time since last crawl. Freshness decays linearly from 1.0 (fresh) to
0.0 (stale) based on tier-specific thresholds.

Usage:
    python -m freshness.freshness_scorer
"""

import logging
import os
import sys
from datetime import datetime, timezone

import click
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

# Freshness thresholds by tier (max age in days before score reaches 0)
TIER_MAX_AGE_DAYS = {
    "tier_1": 14,
    "tier_2": 21,
    "tier_3": 30,
    "tier_4": 45,
    "tier_5": 45,
}

ALL_INDICES = [
    "edot-assistant-docs-elastic",
    "edot-assistant-docs-otel",
    "edot-assistant-github-repos",
    "edot-assistant-blogs",
    "edot-assistant-community",
]


def get_es_client() -> Elasticsearch:
    """Create an Elasticsearch client from environment variables."""
    url = os.environ.get("ELASTICSEARCH_URL")
    api_key = os.environ.get("ELASTICSEARCH_API_KEY")
    if not url or not api_key:
        console.print("[red]Error:[/red] ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY must be set.")
        sys.exit(1)
    return Elasticsearch(url, api_key=api_key)


def update_freshness_scores(es: Elasticsearch, index: str) -> dict:
    """Recalculate freshness_score for all documents in an index.

    Uses an update_by_query with a Painless script that computes:
      freshness_score = max(0, 1.0 - (days_since_crawl / max_age_days))

    Returns dict with updated/failed counts.
    """
    console.print(f"\n  Updating freshness scores for [cyan]{index}[/cyan]...")

    # Build the Painless script that handles all tiers
    tier_thresholds = ", ".join(
        f"'{tier}': {days}" for tier, days in TIER_MAX_AGE_DAYS.items()
    )

    script = f"""
        Map thresholds = [{tier_thresholds}];
        String tier = ctx._source.source_tier;
        if (tier == null) {{ tier = 'tier_3'; }}
        int maxAge = thresholds.containsKey(tier) ? thresholds.get(tier) : 30;

        if (ctx._source.last_crawled != null) {{
            long crawledMillis = ZonedDateTime.parse(ctx._source.last_crawled).toInstant().toEpochMilli();
            long nowMillis = System.currentTimeMillis();
            double daysSince = (nowMillis - crawledMillis) / 86400000.0;
            double score = Math.max(0.0, 1.0 - (daysSince / maxAge));
            ctx._source.freshness_score = Math.round(score * 1000.0) / 1000.0;
        }} else {{
            ctx._source.freshness_score = 0.0;
        }}
    """

    try:
        result = es.update_by_query(
            index=index,
            body={
                "script": {
                    "source": script,
                    "lang": "painless",
                },
                "query": {"match_all": {}},
            },
            conflicts="proceed",
            refresh=True,
        )
        updated = result.get("updated", 0)
        failures = len(result.get("failures", []))
        total = result.get("total", 0)

        console.print(f"    Updated: {updated}/{total}, Failures: {failures}")
        return {"index": index, "total": total, "updated": updated, "failures": failures}
    except Exception as e:
        console.print(f"    [red]Error:[/red] {e}")
        return {"index": index, "total": 0, "updated": 0, "failures": -1, "error": str(e)}


def get_freshness_stats(es: Elasticsearch, index: str) -> dict:
    """Get freshness score statistics for an index."""
    try:
        result = es.search(
            index=index,
            body={
                "size": 0,
                "aggs": {
                    "avg_freshness": {"avg": {"field": "freshness_score"}},
                    "min_freshness": {"min": {"field": "freshness_score"}},
                    "max_freshness": {"max": {"field": "freshness_score"}},
                    "stale_count": {
                        "filter": {"range": {"freshness_score": {"lt": 0.3}}}
                    },
                    "by_tier": {
                        "terms": {"field": "source_tier"},
                        "aggs": {
                            "avg_score": {"avg": {"field": "freshness_score"}},
                        },
                    },
                },
            },
        )
        aggs = result["aggregations"]
        return {
            "total": result["hits"]["total"]["value"],
            "avg": aggs["avg_freshness"]["value"],
            "min": aggs["min_freshness"]["value"],
            "max": aggs["max_freshness"]["value"],
            "stale_count": aggs["stale_count"]["doc_count"],
        }
    except Exception as e:
        logger.error("Error getting freshness stats for %s: %s", index, e)
        return {}


@click.command()
@click.option("--index", default=None, help="Update a specific index only.")
@click.option("--stats-only", is_flag=True, help="Only show freshness statistics.")
def main(index: str | None, stats_only: bool) -> None:
    """Recalculate freshness scores across all EDOT Assistant indices."""
    console.print("[bold blue]EDOT Assistant — Freshness Scorer[/bold blue]")

    es = get_es_client()

    try:
        es.info()
    except Exception as e:
        console.print(f"[red]Cannot connect to Elasticsearch:[/red] {e}")
        sys.exit(1)

    indices = [index] if index else ALL_INDICES

    if stats_only:
        table = Table(title="Freshness Statistics")
        table.add_column("Index", style="cyan")
        table.add_column("Docs", justify="right")
        table.add_column("Avg Score", justify="right")
        table.add_column("Min", justify="right")
        table.add_column("Max", justify="right")
        table.add_column("Stale (<0.3)", justify="right", style="red")

        for idx in indices:
            stats = get_freshness_stats(es, idx)
            if stats:
                table.add_row(
                    idx,
                    str(stats.get("total", 0)),
                    f"{stats.get('avg', 0):.3f}" if stats.get("avg") is not None else "-",
                    f"{stats.get('min', 0):.3f}" if stats.get("min") is not None else "-",
                    f"{stats.get('max', 0):.3f}" if stats.get("max") is not None else "-",
                    str(stats.get("stale_count", 0)),
                )
            else:
                table.add_row(idx, "-", "-", "-", "-", "-")

        console.print(table)
        return

    # Update freshness scores
    console.print("[bold]Updating freshness scores...[/bold]")
    results = []
    for idx in indices:
        result = update_freshness_scores(es, idx)
        results.append(result)

    # Summary
    table = Table(title="Freshness Update Summary")
    table.add_column("Index", style="cyan")
    table.add_column("Total", justify="right")
    table.add_column("Updated", justify="right", style="green")
    table.add_column("Failures", justify="right", style="red")

    for r in results:
        table.add_row(
            r["index"],
            str(r["total"]),
            str(r["updated"]),
            str(r["failures"]),
        )

    console.print(f"\n")
    console.print(table)
    console.print("\n[green]Freshness scores updated.[/green]")


if __name__ == "__main__":
    main()
