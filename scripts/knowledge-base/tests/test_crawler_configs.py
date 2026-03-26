"""Validation tests for Open Web Crawler configuration files."""

import os
import re
from pathlib import Path
from urllib.parse import urlparse

import pytest
import requests
import yaml


KB_ROOT = Path(__file__).parent.parent
CRAWLER_DIR = KB_ROOT / "crawler-configs"


def load_configs() -> dict[str, dict]:
    """Load all crawler YAML configs."""
    configs: dict[str, dict] = {}
    for config_path in sorted(CRAWLER_DIR.glob("*.yml")):
        with open(config_path, "r", encoding="utf-8") as handle:
            configs[config_path.name] = yaml.safe_load(handle)
    return configs


def matches_rule(path: str, rule: dict) -> bool:
    """Check if URL path matches a crawl rule."""
    rule_type = rule.get("type")
    pattern = rule.get("pattern", "")
    if rule_type == "begins":
        return path.startswith(pattern)
    if rule_type == "regex":
        return re.match(pattern, path) is not None
    return False


def is_allowed(url: str, rules: list[dict]) -> bool:
    """Apply ordered crawl rules using first-match semantics."""
    path = urlparse(url).path
    for rule in rules:
        if matches_rule(path, rule):
            return rule.get("policy") == "allow"
    return False


@pytest.mark.skipif(
    not os.environ.get("ELASTICSEARCH_URL"),
    reason="Phase 5 tests require live environment configuration",
)
class TestCrawlerConfigs:
    """Crawler config safety and behavior checks."""

    def test_crawler_yaml_loads(self) -> None:
        configs = load_configs()
        assert set(configs.keys()) == {"blogs.yml", "elastic-docs.yml", "otel-docs.yml"}

        for filename, config in configs.items():
            assert "output_sink" in config, f"Missing output_sink in {filename}"
            assert "output_index" in config, f"Missing output_index in {filename}"
            assert "domains" in config and isinstance(config["domains"], list), (
                f"Invalid domains in {filename}"
            )

    def test_output_index_matches_plan(self) -> None:
        for filename, config in load_configs().items():
            assert config["output_index"] == "edot-kb-docs", (
                f"Unexpected output_index in {filename}"
            )

    def test_elasticsearch_config_uses_env_vars(self) -> None:
        for filename in ["elastic-docs.yml", "otel-docs.yml", "blogs.yml"]:
            content = (CRAWLER_DIR / filename).read_text(encoding="utf-8")
            assert "ENV['ES_HOST']" in content, f"ES_HOST env placeholder missing in {filename}"
            assert "ENV['ES_API_KEY']" in content, f"ES_API_KEY env placeholder missing in {filename}"

    def test_seed_urls_are_reachable(self) -> None:
        for config in load_configs().values():
            for domain in config.get("domains", []):
                for seed_url in domain.get("seed_urls", []):
                    response = requests.head(seed_url, allow_redirects=True, timeout=20)
                    assert response.status_code in {200, 301, 302}, (
                        f"Seed URL not reachable: {seed_url} ({response.status_code})"
                    )

    def test_crawl_rules_match_expected_patterns(self) -> None:
        configs = load_configs()

        elastic_rules = configs["elastic-docs.yml"]["domains"][0]["crawl_rules"]
        assert is_allowed(
            "https://www.elastic.co/docs/reference/opentelemetry/edot-sdks/python",
            elastic_rules,
        )
        assert not is_allowed("https://www.elastic.co/blog", elastic_rules)

        otel_rules = configs["otel-docs.yml"]["domains"][0]["crawl_rules"]
        assert is_allowed("https://opentelemetry.io/docs/collector/configuration", otel_rules)
        assert not is_allowed("https://opentelemetry.io/blog", otel_rules)

        blogs_rules = configs["blogs.yml"]["domains"][0]["crawl_rules"]
        assert is_allowed("https://www.elastic.co/search-labs/blog/jina-embeddings-v5-text", blogs_rules)
        assert not is_allowed("https://www.elastic.co/docs", blogs_rules)
