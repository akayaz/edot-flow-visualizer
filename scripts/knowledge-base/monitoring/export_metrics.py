"""Export ingestion metrics for monitoring.

Queries Elasticsearch indices to produce metrics about the knowledge base:
- Document counts per index
- Freshness score statistics
- Staleness counts
- Last ingestion timestamps

Usage:
    python -m monitoring.export_metrics
    python -m monitoring.export_metrics --json
"""

import json
import logging
import os
import sys

import click
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

ALL_INDICES = [
    "edot-kb-docs",
    "edot-kb-github",
]


def get_es_client() -> Elasticsearch:
    """Create an Elasticsearch client from environment variables."""
    url = os.environ.get("ELASTICSEARCH_URL")
    api_key = os.environ.get("ELASTICSEARCH_API_KEY")
    if not url or not api_key:
        console.print("[red]Error:[/red] ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY must be set.")
        sys.exit(1)
    return Elasticsearch(url, api_key=api_key)


def collect_index_metrics(es: Elasticsearch, index: str) -> dict:
    """Collect comprehensive metrics for a single index."""
    metrics = {
        "index": index,
        "doc_count": 0,
        "size_bytes": 0,
        "avg_freshness": None,
        "stale_count": 0,
        "last_crawled": None,
        "by_content_type": {},
        "by_tier": {},
    }

    try:
        # Index stats
        stats = es.indices.stats(index=index)
        metrics["doc_count"] = stats["_all"]["primaries"]["docs"]["count"]
        metrics["size_bytes"] = stats["_all"]["primaries"]["store"]["size_in_bytes"]

        # Aggregations
        result = es.search(
            index=index,
            body={
                "size": 0,
                "aggs": {
                    "avg_freshness": {"avg": {"field": "freshness_score"}},
                    "stale": {"filter": {"range": {"freshness_score": {"lt": 0.3}}}},
                    "last_crawled": {"max": {"field": "last_crawled"}},
                    "by_content_type": {
                        "terms": {"field": "content_type", "size": 20},
                    },
                    "by_tier": {
                        "terms": {"field": "source_tier", "size": 10},
                        "aggs": {
                            "avg_score": {"avg": {"field": "freshness_score"}},
                        },
                    },
                },
            },
        )
        aggs = result["aggregations"]
        metrics["avg_freshness"] = aggs["avg_freshness"]["value"]
        metrics["stale_count"] = aggs["stale"]["doc_count"]
        metrics["last_crawled"] = aggs["last_crawled"]["value_as_string"]

        for bucket in aggs["by_content_type"]["buckets"]:
            metrics["by_content_type"][bucket["key"]] = bucket["doc_count"]

        for bucket in aggs["by_tier"]["buckets"]:
            metrics["by_tier"][bucket["key"]] = {
                "count": bucket["doc_count"],
                "avg_freshness": bucket["avg_score"]["value"],
            }

    except Exception as e:
        logger.error("Error collecting metrics for %s: %s", index, e)
        metrics["error"] = str(e)

    return metrics


@click.command()
@click.option("--json-output", "as_json", is_flag=True, help="Output as JSON.")
def main(as_json: bool) -> None:
    """Export knowledge base metrics for monitoring."""
    console.print("[bold blue]EDOT Assistant — Metrics Export[/bold blue]")

    es = get_es_client()
    all_metrics = []

    for index in ALL_INDICES:
        metrics = collect_index_metrics(es, index)
        all_metrics.append(metrics)

    if as_json:
        print(json.dumps(all_metrics, indent=2, default=str))
        return

    # Rich table output
    table = Table(title="Knowledge Base Metrics")
    table.add_column("Index", style="cyan")
    table.add_column("Docs", justify="right")
    table.add_column("Size", justify="right")
    table.add_column("Avg Freshness", justify="right")
    table.add_column("Stale", justify="right", style="red")
    table.add_column("Last Crawled")

    total_docs = 0
    total_stale = 0

    for m in all_metrics:
        size_str = (
            f"{m['size_bytes'] / 1024:.0f} KB"
            if m["size_bytes"] < 1_048_576
            else f"{m['size_bytes'] / 1_048_576:.1f} MB"
        )
        avg_str = f"{m['avg_freshness']:.3f}" if m["avg_freshness"] is not None else "-"
        last_str = m["last_crawled"][:19] if m["last_crawled"] else "-"

        table.add_row(
            m["index"].replace("edot-kb-", ""),
            str(m["doc_count"]),
            size_str,
            avg_str,
            str(m["stale_count"]),
            last_str,
        )
        total_docs += m["doc_count"]
        total_stale += m["stale_count"]

    table.add_section()
    table.add_row("[bold]TOTAL[/bold]", str(total_docs), "", "", str(total_stale), "")

    console.print(table)


if __name__ == "__main__":
    main()
