"""Generate Open Web Crawler configuration for Kibana.

Produces a JSON configuration that can be imported into Kibana to set up
the Elastic Open Web Crawler for full documentation site crawls.

Usage:
    python -m ingest.web_crawler_config
"""

import json
import logging
from pathlib import Path

import click
import yaml
from rich.console import Console

console = Console()
logger = logging.getLogger(__name__)

SOURCES_FILE = Path(__file__).parent.parent / "config" / "sources.yaml"
OUTPUT_DIR = Path(__file__).parent.parent / "config"


def load_sources() -> dict:
    """Load the sources.yaml configuration."""
    with open(SOURCES_FILE, "r") as f:
        return yaml.safe_load(f)


def generate_crawler_config(sources: dict) -> dict:
    """Generate Open Web Crawler configuration from sources.yaml.

    Creates entry points and crawl rules for all web-based sources.
    """
    entry_points = []
    crawl_rules = []
    extraction_rules = []

    # Process web sources from all tiers
    for tier_key in ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"]:
        tier_sources = sources.get("sources", {}).get(tier_key, [])
        for source in tier_sources:
            url = source.get("url")
            if not url:
                continue

            entry_points.append({
                "url": url,
                "label": source.get("name", url),
                "tier": tier_key,
            })

            # Content extraction rules
            content_selector = source.get("content_selector")
            remove_selector = source.get("remove_selector")
            if content_selector:
                extraction_rules.append({
                    "url_pattern": url + "*",
                    "content_selector": content_selector,
                    "remove_selectors": remove_selector.split(", ") if remove_selector else [],
                })

    # Crawl rules to scope the crawler
    crawl_rules = [
        # Allow documentation paths
        {"pattern": "*/docs/*", "policy": "allow"},
        {"pattern": "*/blog/*", "policy": "allow"},
        {"pattern": "*/observability-labs/*", "policy": "allow"},
        {"pattern": "*/search-labs/*", "policy": "allow"},
        # Deny non-content paths
        {"pattern": "*/api/*", "policy": "deny"},
        {"pattern": "*/login*", "policy": "deny"},
        {"pattern": "*/signup*", "policy": "deny"},
        {"pattern": "*/cart*", "policy": "deny"},
        {"pattern": "*/pricing*", "policy": "deny"},
    ]

    config = {
        "name": "EDOT Assistant Documentation Crawler",
        "description": "Crawls EDOT, OpenTelemetry, and Elastic documentation sites for the EDOT Assistant knowledge base.",
        "entry_points": entry_points,
        "crawl_rules": crawl_rules,
        "extraction_rules": extraction_rules,
        "settings": {
            "max_crawl_depth": 5,
            "max_pages": 10000,
            "crawl_interval": "weekly",
            "respect_robots_txt": True,
            "user_agent": "EDOT-Assistant-Crawler/1.0",
            "max_concurrent_requests": 5,
            "request_delay_ms": 500,
        },
    }

    return config


@click.command()
@click.option(
    "--output",
    type=click.Path(),
    default=None,
    help="Output file path. Defaults to config/web_crawler_config.json.",
)
def main(output: str) -> None:
    """Generate Open Web Crawler configuration for Kibana."""
    console.print("[bold blue]EDOT Assistant — Web Crawler Config Generator[/bold blue]")

    sources = load_sources()
    config = generate_crawler_config(sources)

    output_path = Path(output) if output else OUTPUT_DIR / "web_crawler_config.json"
    with open(output_path, "w") as f:
        json.dump(config, f, indent=2)

    console.print(f"\n[green]Crawler config written to:[/green] {output_path}")
    console.print(f"  Entry points: {len(config['entry_points'])}")
    console.print(f"  Crawl rules: {len(config['crawl_rules'])}")
    console.print(f"  Extraction rules: {len(config['extraction_rules'])}")
    console.print(
        "\nImport this configuration in Kibana under "
        "Search > Web Crawler to start crawling."
    )


if __name__ == "__main__":
    main()
