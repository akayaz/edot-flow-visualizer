"""Configuration validation tests for the knowledge-base stack."""

import json
from pathlib import Path

import pytest
import yaml


KB_ROOT = Path(__file__).parent.parent
CONFIG_DIR = KB_ROOT / "config"
CRAWLER_DIR = KB_ROOT / "crawler-configs"
TOOLS_DIR = CONFIG_DIR / "agent_builder" / "tools"
ENV_FILE = KB_ROOT / ".env.example"

REQUIRED_MAPPING_FIELDS = {
    "title",
    "body",
    "body_semantic",
    "url",
    "source_tier",
    "tags",
    "content_hash",
    "last_crawled",
}

FORBIDDEN_JINA_READER_FIELDS = {
    "content_selector",
    "remove_selector",
    "sitemap_filter",
}

OLD_INDEX_NAMES = {
    "edot-assistant-docs-elastic",
    "edot-assistant-docs-otel",
    "edot-assistant-github-repos",
    "edot-assistant-blogs",
    "edot-assistant-community",
}


def test_crawler_configs_are_valid_yaml() -> None:
    crawler_files = sorted(CRAWLER_DIR.glob("*.yml"))
    assert crawler_files, "No crawler config files found"

    for crawler_file in crawler_files:
        with open(crawler_file, "r", encoding="utf-8") as handle:
            config = yaml.safe_load(handle)

        assert isinstance(config, dict), f"Invalid YAML object in {crawler_file.name}"
        for key in ["output_sink", "output_index", "domains", "elasticsearch"]:
            assert key in config, f"Missing '{key}' in {crawler_file.name}"

        assert config["output_sink"] == "elasticsearch"
        assert config["output_index"] == "edot-kb-docs"
        assert isinstance(config["domains"], list) and config["domains"], (
            f"'domains' must be a non-empty list in {crawler_file.name}"
        )

        for domain in config["domains"]:
            assert "url" in domain, f"Missing domain url in {crawler_file.name}"
            if "crawl_rules" in domain:
                for rule in domain["crawl_rules"]:
                    for field in ["policy", "type", "pattern"]:
                        assert field in rule, (
                            f"Missing crawl rule field '{field}' in {crawler_file.name}"
                        )


def test_index_mappings_have_semantic_text() -> None:
    mappings = ["docs.json", "github.json"]
    for filename in mappings:
        mapping_path = CONFIG_DIR / "index_mappings" / filename
        assert mapping_path.exists(), f"Mapping file missing: {filename}"

        with open(mapping_path, "r", encoding="utf-8") as handle:
            mapping = json.load(handle)

        props = mapping.get("mappings", {}).get("properties", {})
        assert REQUIRED_MAPPING_FIELDS.issubset(set(props.keys())), (
            f"Missing required fields in {filename}"
        )

        body_semantic = props.get("body_semantic", {})
        assert body_semantic.get("type") == "semantic_text"
        assert body_semantic.get("inference_id") == "jina-v5-small"

        if filename == "github.json":
            code_semantic = props.get("code_semantic", {})
            assert code_semantic.get("type") == "semantic_text"
            assert code_semantic.get("inference_id") == "jina-code"


def test_sources_yaml_structure_and_no_jina_reader_fields() -> None:
    sources_path = CONFIG_DIR / "sources.yaml"
    with open(sources_path, "r", encoding="utf-8") as handle:
        sources = yaml.safe_load(handle)

    assert "sources" in sources and isinstance(sources["sources"], dict)
    tier_keys = [k for k in sources["sources"].keys() if k.startswith("tier_")]
    assert tier_keys, "No tiered sources configured"

    for tier_key in tier_keys:
        tier_sources = sources["sources"].get(tier_key, [])
        assert isinstance(tier_sources, list), f"{tier_key} must be a list"
        for source in tier_sources:
            assert "name" in source, f"Missing source name in {tier_key}"
            has_url = "url" in source
            has_repo = "repo" in source
            assert has_url or has_repo, f"Source must have url or repo in {tier_key}"

            for forbidden in FORBIDDEN_JINA_READER_FIELDS:
                assert forbidden not in source, (
                    f"Found deprecated field '{forbidden}' in {tier_key}/{source.get('name')}"
                )


def test_agent_tools_use_new_indices_and_have_esql() -> None:
    tool_files = sorted(TOOLS_DIR.glob("*.json"))
    assert tool_files, "No agent tool files found"

    for tool_file in tool_files:
        with open(tool_file, "r", encoding="utf-8") as handle:
            tool = json.load(handle)

        query = tool.get("configuration", {}).get("query", "")
        assert isinstance(query, str) and query.strip(), f"Missing query in {tool_file.name}"
        assert query.lstrip().startswith("FROM "), f"Query must start with FROM in {tool_file.name}"

        for old_name in OLD_INDEX_NAMES:
            assert old_name not in query, f"Old index name '{old_name}' still used in {tool_file.name}"

        assert ("edot-kb-docs" in query) or ("edot-kb-github" in query), (
            f"New index name missing in {tool_file.name}"
        )


def test_env_example_contains_required_keys() -> None:
    assert ENV_FILE.exists(), ".env.example not found"
    content = ENV_FILE.read_text(encoding="utf-8")

    required = [
        "ELASTICSEARCH_URL",
        "ELASTICSEARCH_API_KEY",
        "GITHUB_TOKEN",
        "JINA_API_KEY",
        "AGENT_BUILDER_URL",
        "AGENT_BUILDER_API_KEY",
    ]
    for key in required:
        assert key in content, f"Missing required env key: {key}"
