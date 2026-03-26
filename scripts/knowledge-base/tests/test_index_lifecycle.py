"""Integration tests for index lifecycle and semantic search behavior."""

import json
import os
from pathlib import Path

import pytest
from dotenv import load_dotenv
from elasticsearch import BadRequestError, Elasticsearch

load_dotenv()

KB_ROOT = Path(__file__).parent.parent
MAPPINGS_DIR = KB_ROOT / "config" / "index_mappings"
DOCS_INDEX = "edot-kb-docs-test"
GITHUB_INDEX = "edot-kb-github-test"
INFERENCE_ID = "jina-v5-small"
MODEL_ID = "jina-embeddings-v5-text-small"
CODE_INFERENCE_ID = "jina-code"
CODE_MODEL_ID = "jina-code-embeddings-1.5b"
CODE_DIMS = 1024
FALLBACK_CODE_MODEL_ID = "jina-embeddings-v5-text-small"


def get_es_client() -> Elasticsearch:
    """Create Elasticsearch client from environment."""
    url = os.environ.get("ELASTICSEARCH_URL")
    api_key = os.environ.get("ELASTICSEARCH_API_KEY")
    if not url or not api_key:
        pytest.skip("ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY not configured")
    return Elasticsearch(url, api_key=api_key)


def ensure_endpoint(es: Elasticsearch) -> None:
    """Ensure inference endpoint exists."""
    try:
        existing = es.inference.get(inference_id=INFERENCE_ID)
        if existing:
            return
    except Exception:
        pass

    last_error: Exception | None = None
    for _ in range(3):
        try:
            es.inference.put(
                inference_id=INFERENCE_ID,
                task_type="text_embedding",
                body={
                    "service": "elastic",
                    "service_settings": {"model_id": MODEL_ID},
                },
            )
            return
        except BadRequestError as exc:
            if "resource_already_exists_exception" in str(exc):
                return
            raise
        except Exception as exc:
            last_error = exc

    pytest.skip(f"Could not ensure inference endpoint due transient error: {last_error}")


def ensure_code_endpoint(es: Elasticsearch) -> None:
    """Ensure code endpoint exists, with compatibility fallback."""
    api_key = os.environ.get("JINA_API_KEY")

    try:
        existing = es.inference.get(inference_id=CODE_INFERENCE_ID)
        if existing:
            return
    except Exception:
        pass

    if api_key:
        try:
            es.inference.put(
                inference_id=CODE_INFERENCE_ID,
                task_type="text_embedding",
                body={
                    "service": "jinaai",
                    "service_settings": {
                        "model_id": CODE_MODEL_ID,
                        "api_key": api_key,
                        "dimensions": CODE_DIMS,
                    },
                },
            )
            return
        except BadRequestError as exc:
            if "resource_already_exists_exception" in str(exc):
                return
        except Exception:
            pass

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


def load_mapping(filename: str) -> dict:
    """Load mapping JSON from disk."""
    with open(MAPPINGS_DIR / filename, "r", encoding="utf-8") as handle:
        return json.load(handle)


@pytest.fixture(scope="module")
def es_client() -> Elasticsearch:
    """Provide Elasticsearch client for tests."""
    return get_es_client()


@pytest.fixture(scope="module", autouse=True)
def setup_test_indices(es_client: Elasticsearch):
    """Create and tear down test indices."""
    ensure_endpoint(es_client)
    if os.environ.get("JINA_API_KEY"):
        ensure_code_endpoint(es_client)
    for index_name in [DOCS_INDEX, GITHUB_INDEX]:
        if es_client.indices.exists(index=index_name):
            es_client.indices.delete(index=index_name)

    es_client.indices.create(index=DOCS_INDEX, body=load_mapping("docs.json"))
    try:
        es_client.indices.create(index=GITHUB_INDEX, body=load_mapping("github.json"))
    except Exception as exc:
        if not os.environ.get("JINA_API_KEY"):
            pytest.skip(f"Skipping github mapping creation without JINA_API_KEY: {exc}")
        raise
    yield

    for index_name in [DOCS_INDEX, GITHUB_INDEX]:
        if es_client.indices.exists(index=index_name):
            es_client.indices.delete(index=index_name)


@pytest.mark.skipif(
    not os.environ.get("ELASTICSEARCH_URL"),
    reason="Elasticsearch not configured",
)
class TestIndexLifecycle:
    """Live cluster tests for index setup and semantic behavior."""

    def test_create_edot_kb_docs_index(self, es_client: Elasticsearch) -> None:
        assert es_client.indices.exists(index=DOCS_INDEX)
        mapping = es_client.indices.get_mapping(index=DOCS_INDEX)
        props = mapping[DOCS_INDEX]["mappings"]["properties"]
        assert props["body_semantic"]["type"] == "semantic_text"
        assert props["body_semantic"]["inference_id"] == INFERENCE_ID

    def test_create_edot_kb_github_index(self, es_client: Elasticsearch) -> None:
        assert es_client.indices.exists(index=GITHUB_INDEX)
        mapping = es_client.indices.get_mapping(index=GITHUB_INDEX)
        props = mapping[GITHUB_INDEX]["mappings"]["properties"]
        assert props["body_semantic"]["type"] == "semantic_text"
        assert props["body_semantic"]["inference_id"] == INFERENCE_ID
        assert props["code_semantic"]["type"] == "semantic_text"
        assert props["code_semantic"]["inference_id"] == CODE_INFERENCE_ID

    def test_index_document_generates_embeddings(self, es_client: Elasticsearch) -> None:
        doc = {
            "title": "EDOT Collector Setup",
            "body": "Use otlp exporter and configure Authorization Bearer token.",
            "url": "https://example.local/edot/setup",
            "source_tier": "tier_1",
            "content_type": "documentation",
            "tags": ["edot", "collector"],
            "content_hash": "hash-1",
            "last_crawled": "2026-01-01T00:00:00Z",
        }
        es_client.index(index=DOCS_INDEX, id="doc-1", document=doc)
        es_client.indices.refresh(index=DOCS_INDEX)

        result = es_client.search(
            index=DOCS_INDEX,
            body={
                "query": {
                    "semantic": {
                        "field": "body_semantic",
                        "query": "How do I configure an EDOT collector exporter?",
                    }
                },
                "size": 3,
            },
        )
        assert result["hits"]["total"]["value"] >= 1

    def test_semantic_search_returns_results(self, es_client: Elasticsearch) -> None:
        docs = [
            {
                "doc_id": "bulk-1",
                "title": "Collector memory_limiter",
                "body": "memory_limiter should be first in processors list.",
                "url": "https://example.local/collector/memory",
                "source_tier": "tier_1",
                "content_type": "documentation",
                "tags": ["collector"],
                "content_hash": "hash-2",
                "last_crawled": "2026-01-01T00:00:00Z",
            },
            {
                "doc_id": "bulk-2",
                "title": "SDK context propagation",
                "body": "W3C traceparent carries tracing context across services.",
                "url": "https://example.local/sdk/context",
                "source_tier": "tier_3",
                "content_type": "documentation",
                "tags": ["sdk"],
                "content_hash": "hash-3",
                "last_crawled": "2026-01-01T00:00:00Z",
            },
        ]
        for doc in docs:
            doc_id = doc["doc_id"]
            payload = {k: v for k, v in doc.items() if k != "doc_id"}
            es_client.index(index=DOCS_INDEX, id=doc_id, document=payload)
        es_client.indices.refresh(index=DOCS_INDEX)

        result = es_client.search(
            index=DOCS_INDEX,
            body={
                "query": {
                    "semantic": {
                        "field": "body_semantic",
                        "query": "What is traceparent used for?",
                    }
                },
                "size": 5,
            },
        )
        assert result["hits"]["total"]["value"] >= 1
        assert result["hits"]["hits"][0]["_score"] > 0

    def test_copy_to_populates_semantic_field(self, es_client: Elasticsearch) -> None:
        doc = {
            "title": "OTLP receiver protocols",
            "body": "Enable grpc on 4317 and http on 4318 for otlp receiver.",
            "url": "https://example.local/collector/otlp",
            "source_tier": "tier_1",
            "content_type": "documentation",
            "tags": ["otlp"],
            "content_hash": "hash-4",
            "last_crawled": "2026-01-01T00:00:00Z",
        }
        es_client.index(index=DOCS_INDEX, id="copyto-1", document=doc)
        es_client.indices.refresh(index=DOCS_INDEX)

        result = es_client.search(
            index=DOCS_INDEX,
            body={
                "query": {
                    "semantic": {
                        "field": "body_semantic",
                        "query": "Which ports are used by OTLP grpc and http?",
                    }
                },
                "size": 1,
            },
        )
        assert result["hits"]["total"]["value"] >= 1

    def test_keyword_filters_work_with_semantic(self, es_client: Elasticsearch) -> None:
        result = es_client.search(
            index=DOCS_INDEX,
            body={
                "query": {
                    "bool": {
                        "must": [
                            {
                                "semantic": {
                                    "field": "body_semantic",
                                    "query": "context propagation",
                                }
                            }
                        ],
                        "filter": [
                            {"term": {"source_tier": "tier_3"}},
                        ],
                    }
                },
                "size": 5,
            },
        )
        assert result["hits"]["total"]["value"] >= 1

    @pytest.mark.skipif(
        not os.environ.get("JINA_API_KEY"),
        reason="JINA_API_KEY not configured",
    )
    def test_code_semantic_search_returns_results(self, es_client: Elasticsearch) -> None:
        ensure_code_endpoint(es_client)

        doc = {
            "title": "python-otlp-exporter.py",
            "body": "Python OTLP exporter example for EDOT.",
            "code_semantic": (
                "from opentelemetry.exporter.otlp.proto.grpc.trace_exporter "
                "import OTLPSpanExporter\n"
                "exporter = OTLPSpanExporter(endpoint='http://localhost:4317')"
            ),
            "url": "https://example.local/python/otlp-exporter",
            "source_tier": "tier_2",
            "source_type": "github",
            "repo": "elastic/opentelemetry",
            "content_type": "code_example",
            "tags": ["python", "otlp", "example"],
            "content_hash": "hash-code-1",
            "last_crawled": "2026-01-01T00:00:00Z",
        }
        es_client.index(index=GITHUB_INDEX, id="code-1", document=doc)
        es_client.indices.refresh(index=GITHUB_INDEX)

        result = es_client.search(
            index=GITHUB_INDEX,
            body={
                "query": {
                    "semantic": {
                        "field": "code_semantic",
                        "query": "how to configure otlp exporter in python",
                    }
                },
                "size": 3,
            },
        )
        assert result["hits"]["total"]["value"] >= 1
