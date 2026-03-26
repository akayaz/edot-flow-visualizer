"""End-to-end smoke tests for the knowledge base pipeline."""

import json
import os
import re
import time
from pathlib import Path
from typing import Callable, TypeVar

import pytest
from dotenv import load_dotenv
from elasticsearch import BadRequestError, Elasticsearch

load_dotenv()

KB_ROOT = Path(__file__).parent.parent
MAPPINGS_DIR = KB_ROOT / "config" / "index_mappings"
TOOLS_DIR = KB_ROOT / "config" / "agent_builder" / "tools"

DOCS_INDEX = "edot-kb-docs-smoke"
GITHUB_INDEX = "edot-kb-github-smoke"
INFERENCE_ID = "jina-v5-small"
MODEL_ID = "jina-embeddings-v5-text-small"
CODE_INFERENCE_ID = "jina-code"
CODE_MODEL_ID = "jina-code-embeddings-1.5b"
CODE_DIMS = 1024
FALLBACK_CODE_MODEL_ID = "jina-embeddings-v5-text-small"
ES_REQUEST_TIMEOUT_SECONDS = 60
ES_CLIENT_MAX_RETRIES = 5
ES_RETRY_ATTEMPTS = 8
ES_RETRY_BASE_DELAY_SECONDS = 2.0

T = TypeVar("T")


def get_es_client() -> Elasticsearch:
    """Create Elasticsearch client from environment."""
    url = os.environ.get("ELASTICSEARCH_URL")
    api_key = os.environ.get("ELASTICSEARCH_API_KEY")
    if not url or not api_key:
        pytest.skip("ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY not configured")
    return Elasticsearch(
        url,
        api_key=api_key,
        request_timeout=ES_REQUEST_TIMEOUT_SECONDS,
        retry_on_timeout=True,
        max_retries=ES_CLIENT_MAX_RETRIES,
    )


def run_with_retry(
    action: Callable[[], T],
    description: str,
    attempts: int = ES_RETRY_ATTEMPTS,
    base_delay_seconds: float = ES_RETRY_BASE_DELAY_SECONDS,
) -> T:
    """Run an Elasticsearch action with retry/backoff for transient failures."""
    delay = base_delay_seconds
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return action()
        except Exception as exc:
            last_error = exc
            if attempt == attempts:
                break
            time.sleep(delay)
            delay = min(delay * 1.8, 20.0)
    raise RuntimeError(
        f"{description} failed after {attempts} attempts: {last_error}"
    ) from last_error


def ensure_endpoints(es: Elasticsearch, require_code: bool = False) -> None:
    """Ensure required semantic inference endpoints exist."""
    def ensure_text_endpoint() -> None:
        try:
            existing = es.inference.get(inference_id=INFERENCE_ID)
            if existing:
                return
        except Exception:
            # Endpoint may not exist yet, so attempt to create it.
            pass

        try:
            es.inference.put(
                inference_id=INFERENCE_ID,
                task_type="text_embedding",
                body={
                    "service": "elastic",
                    "service_settings": {"model_id": MODEL_ID},
                },
            )
        except BadRequestError as exc:
            if "resource_already_exists_exception" not in str(exc):
                raise

    try:
        run_with_retry(ensure_text_endpoint, "ensure text inference endpoint")
    except Exception as exc:
        pytest.skip(
            f"Could not ensure text inference endpoint due transient error: {exc}"
        )

    jina_api_key = os.environ.get("JINA_API_KEY")
    if jina_api_key:
        def ensure_jina_code_endpoint() -> None:
            try:
                es.inference.put(
                    inference_id=CODE_INFERENCE_ID,
                    task_type="text_embedding",
                    body={
                        "service": "jinaai",
                        "service_settings": {
                            "model_id": CODE_MODEL_ID,
                            "api_key": jina_api_key,
                            "dimensions": CODE_DIMS,
                        },
                    },
                )
            except BadRequestError as exc:
                if "resource_already_exists_exception" not in str(exc):
                    raise

        try:
            run_with_retry(ensure_jina_code_endpoint, "ensure Jina code endpoint")
            return
        except BadRequestError as exc:
            if "resource_already_exists_exception" in str(exc):
                return
        except Exception:
            pass

    def ensure_fallback_code_endpoint() -> None:
        try:
            es.inference.put(
                inference_id=CODE_INFERENCE_ID,
                task_type="text_embedding",
                body={
                    "service": "elastic",
                    "service_settings": {"model_id": FALLBACK_CODE_MODEL_ID},
                },
            )
        except BadRequestError as exc:
            if "resource_already_exists_exception" not in str(exc):
                raise

    try:
        run_with_retry(ensure_fallback_code_endpoint, "ensure fallback code endpoint")
    except Exception as exc:
        if require_code:
            pytest.skip(f"Could not ensure code endpoint for smoke test: {exc}")


def load_mapping(filename: str) -> dict:
    """Load mapping JSON."""
    with open(MAPPINGS_DIR / filename, "r", encoding="utf-8") as handle:
        return json.load(handle)


def substitute_query_params(query: str) -> str:
    """Replace Agent Builder-style placeholders with literals for _query."""
    substitutions = {
        "?query": "\"collector configuration\"",
        "?component_name": "\"batch processor\"",
        "?repo_pattern": "\"%opentelemetry%\"",
    }
    for placeholder, value in substitutions.items():
        query = query.replace(placeholder, value)
    return re.sub(r"\?[a-zA-Z_][a-zA-Z0-9_]*", "\"edot\"", query)


@pytest.mark.skipif(
    not os.environ.get("ELASTICSEARCH_URL"),
    reason="Phase 5 tests require live environment configuration",
)
class TestE2ESmoke:
    """Smoke tests that verify key end-to-end capabilities."""

    def test_full_pipeline_smoke(self) -> None:
        es = get_es_client()
        ensure_endpoints(es, require_code=True)

        for index_name in [DOCS_INDEX, GITHUB_INDEX]:
            exists = run_with_retry(
                lambda idx=index_name: es.indices.exists(index=idx),
                f"check index {index_name} exists",
            )
            if exists:
                run_with_retry(
                    lambda idx=index_name: es.indices.delete(index=idx),
                    f"delete index {index_name}",
                )

        run_with_retry(
            lambda: es.indices.create(index=DOCS_INDEX, body=load_mapping("docs.json")),
            f"create {DOCS_INDEX}",
        )
        try:
            run_with_retry(
                lambda: es.indices.create(index=GITHUB_INDEX, body=load_mapping("github.json")),
                f"create {GITHUB_INDEX}",
            )
        except Exception as exc:
            pytest.skip(f"Could not create github smoke index for dual-model test: {exc}")

        docs = [
            {
                "title": "EDOT Collector OTLP Export",
                "body": "Configure otlp exporter and Authorization bearer token for Elastic APM.",
                "url": "https://example.local/docs/edot-collector-export",
                "source_tier": "tier_1",
                "content_type": "documentation",
                "tags": ["edot", "collector"],
                "content_hash": "smoke-doc-1",
                "last_crawled": "2026-01-01T00:00:00Z",
            },
            {
                "title": "OTel Collector memory_limiter",
                "body": "memory_limiter should be first processor before batch.",
                "url": "https://example.local/docs/otel-memory-limiter",
                "source_tier": "tier_3",
                "content_type": "documentation",
                "tags": ["otel", "collector"],
                "content_hash": "smoke-doc-2",
                "last_crawled": "2026-01-01T00:00:00Z",
            },
            {
                "title": "Context Propagation in OpenTelemetry",
                "body": "Use traceparent and baggage headers for distributed tracing context.",
                "url": "https://example.local/docs/context-propagation",
                "source_tier": "tier_3",
                "content_type": "documentation",
                "tags": ["otel", "tracing"],
                "content_hash": "smoke-doc-3",
                "last_crawled": "2026-01-01T00:00:00Z",
            },
            {
                "title": "Search Labs Blog - Jina v5",
                "body": "Jina v5 embeddings can improve multilingual retrieval quality.",
                "url": "https://example.local/blog/jina-v5",
                "source_tier": "tier_4",
                "content_type": "blog",
                "tags": ["blog", "jina"],
                "content_hash": "smoke-doc-4",
                "last_crawled": "2026-01-01T00:00:00Z",
            },
            {
                "title": "GitHub Release v1.2.3",
                "body": "Release notes include collector pipeline and exporter improvements.",
                "url": "https://github.com/elastic/opentelemetry/releases/tag/v1.2.3",
                "repo": "elastic/opentelemetry",
                "source_tier": "tier_2",
                "source_type": "github",
                "content_type": "release",
                "tags": ["release"],
                "content_hash": "smoke-gh-1",
                "last_crawled": "2026-01-01T00:00:00Z",
                "last_modified": "2026-01-01T00:00:00Z",
                "release_tag": "v1.2.3",
            },
            {
                "title": "collector-config.yaml",
                "body": "receivers: otlp; processors: memory_limiter, batch; exporters: otlp/elastic",
                "code_semantic": (
                    "receivers:\n"
                    "  otlp:\n"
                    "    protocols:\n"
                    "      grpc:\n"
                    "      http:\n"
                    "exporters:\n"
                    "  otlp/elastic:\n"
                    "    endpoint: ${ELASTIC_APM_ENDPOINT}"
                ),
                "url": "https://github.com/elastic/opentelemetry/blob/main/examples/collector-config.yaml",
                "repo": "elastic/opentelemetry",
                "source_tier": "tier_2",
                "source_type": "github",
                "content_type": "yaml_config",
                "tags": ["yaml", "example"],
                "content_hash": "smoke-gh-2",
                "last_crawled": "2026-01-01T00:00:00Z",
            },
            {
                "title": "python-otlp-exporter.py",
                "body": "Python example for OTLP exporter setup.",
                "code_semantic": (
                    "from opentelemetry.exporter.otlp.proto.grpc.trace_exporter "
                    "import OTLPSpanExporter\n"
                    "exporter = OTLPSpanExporter(endpoint='http://collector:4317')"
                ),
                "url": "https://github.com/elastic/opentelemetry/blob/main/examples/python-otlp-exporter.py",
                "repo": "elastic/opentelemetry",
                "source_tier": "tier_2",
                "source_type": "github",
                "content_type": "code_example",
                "tags": ["python", "otlp", "example"],
                "content_hash": "smoke-gh-3",
                "last_crawled": "2026-01-01T00:00:00Z",
            },
        ]

        for idx, doc in enumerate(docs, start=1):
            target_index = DOCS_INDEX if idx <= 4 else GITHUB_INDEX
            run_with_retry(
                lambda i=idx, d=doc, ti=target_index: es.index(
                    index=ti, id=f"smoke-{i}", document=d
                ),
                f"index smoke document {idx}",
            )

        run_with_retry(
            lambda: es.indices.refresh(index=DOCS_INDEX),
            f"refresh {DOCS_INDEX}",
        )
        run_with_retry(
            lambda: es.indices.refresh(index=GITHUB_INDEX),
            f"refresh {GITHUB_INDEX}",
        )

        queries = [
            (DOCS_INDEX, "body_semantic", "How do I configure collector exporter for Elastic?"),
            (DOCS_INDEX, "body_semantic", "What is memory_limiter ordering?"),
            (DOCS_INDEX, "body_semantic", "How does context propagation work?"),
            (GITHUB_INDEX, "body_semantic", "Show me collector yaml examples"),
            (GITHUB_INDEX, "body_semantic", "latest release notes"),
            (GITHUB_INDEX, "code_semantic", "python otlp exporter configuration"),
        ]

        for index_name, field, query in queries:
            result = run_with_retry(
                lambda idx=index_name, f=field, q=query: es.search(
                    index=idx,
                    body={
                        "query": {
                            "semantic": {
                                "field": f,
                                "query": q,
                            }
                        },
                        "size": 3,
                    },
                ),
                f"semantic search on {index_name}:{field}",
            )
            assert result["hits"]["total"]["value"] >= 1
            assert result["hits"]["hits"][0]["_score"] > 0

        # Cleanup for this smoke test.
        run_with_retry(
            lambda: es.indices.delete(index=DOCS_INDEX, ignore_unavailable=True),
            f"cleanup {DOCS_INDEX}",
        )
        run_with_retry(
            lambda: es.indices.delete(index=GITHUB_INDEX, ignore_unavailable=True),
            f"cleanup {GITHUB_INDEX}",
        )

    def test_agent_builder_tool_queries(self) -> None:
        es = get_es_client()
        ensure_endpoints(es)

        # Ensure smoke indices exist so rewritten queries are valid.
        docs_exists = run_with_retry(
            lambda: es.indices.exists(index=DOCS_INDEX),
            f"check {DOCS_INDEX} exists",
        )
        if not docs_exists:
            run_with_retry(
                lambda: es.indices.create(index=DOCS_INDEX, body=load_mapping("docs.json")),
                f"create {DOCS_INDEX}",
            )
        github_exists = run_with_retry(
            lambda: es.indices.exists(index=GITHUB_INDEX),
            f"check {GITHUB_INDEX} exists",
        )
        if not github_exists:
            try:
                run_with_retry(
                    lambda: es.indices.create(index=GITHUB_INDEX, body=load_mapping("github.json")),
                    f"create {GITHUB_INDEX}",
                )
            except Exception as exc:
                pytest.skip(f"Could not create github smoke index: {exc}")

        run_with_retry(
            lambda: es.index(
                index=GITHUB_INDEX,
                id="tool-smoke-1",
                document={
                    "title": "sample code",
                    "body": "python otlp exporter setup",
                    "code_semantic": "exporter = OTLPSpanExporter(endpoint='http://collector:4317')",
                    "url": "https://example.local/tool-smoke-1",
                    "repo": "elastic/opentelemetry",
                    "source_tier": "tier_2",
                    "source_type": "github",
                    "content_type": "code_example",
                    "tags": ["python", "otlp"],
                    "content_hash": "tool-smoke-1",
                    "last_crawled": "2026-01-01T00:00:00Z",
                },
            ),
            "index tool smoke document",
        )
        run_with_retry(
            lambda: es.indices.refresh(index=GITHUB_INDEX),
            f"refresh {GITHUB_INDEX}",
        )

        for tool_file in sorted(TOOLS_DIR.glob("*.json")):
            with open(tool_file, "r", encoding="utf-8") as handle:
                tool = json.load(handle)
            query = tool["configuration"]["query"]
            query = query.replace("edot-kb-docs", DOCS_INDEX)
            query = query.replace("edot-kb-github", GITHUB_INDEX)
            query = substitute_query_params(query)

            response = run_with_retry(
                lambda q=query: es.esql.query(query=q),
                f"run esql for tool {tool.get('id', tool_file.name)}",
            )
            payload = response.body if hasattr(response, "body") else response
            assert isinstance(payload, dict)
            assert "columns" in payload or "values" in payload
            if tool.get("id") == "search_examples":
                assert payload.get("values"), "search_examples should return at least one result"
