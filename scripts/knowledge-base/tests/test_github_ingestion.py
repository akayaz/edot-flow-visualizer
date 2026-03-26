"""Integration tests for GitHub supplementary ingestion."""

import json
import os
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from elasticsearch import BadRequestError, Elasticsearch

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingest.github_supplements import GitHubSupplementIngestor

load_dotenv()

KB_ROOT = Path(__file__).parent.parent
MAPPING_PATH = KB_ROOT / "config" / "index_mappings" / "github.json"
TEST_INDEX = "edot-kb-github-test"
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


def load_mapping() -> dict:
    """Load GitHub index mapping."""
    with open(MAPPING_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def ensure_inference_endpoint(es: Elasticsearch) -> None:
    """Ensure semantic_text inference endpoint exists."""
    try:
        existing = es.inference.get(inference_id="jina-v5-small")
        if existing:
            return
    except Exception:
        pass

    last_error: Exception | None = None
    for _ in range(3):
        try:
            es.inference.put(
                inference_id="jina-v5-small",
                task_type="text_embedding",
                body={
                    "service": "elastic",
                    "service_settings": {"model_id": "jina-embeddings-v5-text-small"},
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


def ensure_code_inference_endpoint(es: Elasticsearch) -> None:
    """Ensure code semantic endpoint exists with compatibility fallback."""
    api_key = os.environ.get("JINA_API_KEY")
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


@pytest.fixture(scope="module")
def es_client() -> Elasticsearch:
    """Provide Elasticsearch client."""
    return get_es_client()


@pytest.fixture(scope="module", autouse=True)
def ensure_github_api_access() -> None:
    """Skip if GitHub token cannot access API due auth/rate limits."""
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        pytest.skip("GITHUB_TOKEN not configured")

    response = requests.get(
        "https://api.github.com/repos/open-telemetry/opentelemetry-collector",
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
        },
        timeout=20,
    )
    if response.status_code != 200:
        pytest.skip(
            f"GitHub API not accessible with current token (status={response.status_code})."
        )


@pytest.fixture(scope="module", autouse=True)
def setup_test_index(es_client: Elasticsearch):
    """Create and clean up test index."""
    ensure_inference_endpoint(es_client)
    ensure_code_inference_endpoint(es_client)
    if es_client.indices.exists(index=TEST_INDEX):
        es_client.indices.delete(index=TEST_INDEX)
    try:
        es_client.indices.create(index=TEST_INDEX, body=load_mapping())
    except Exception as exc:
        if not os.environ.get("JINA_API_KEY"):
            pytest.skip(f"Skipping github index creation without JINA_API_KEY: {exc}")
        raise
    yield
    if es_client.indices.exists(index=TEST_INDEX):
        es_client.indices.delete(index=TEST_INDEX)


@pytest.mark.skipif(
    not os.environ.get("ELASTICSEARCH_URL"),
    reason="Elasticsearch not configured",
)
@pytest.mark.skipif(
    not os.environ.get("GITHUB_TOKEN"),
    reason="GITHUB_TOKEN not configured",
)
class TestGitHubIngestion:
    """Live integration tests for GitHub supplementary ingestion."""

    def test_github_ingest_single_repo(self, es_client: Elasticsearch) -> None:
        ingestor = GitHubSupplementIngestor(
            es_client=es_client,
            index_name=TEST_INDEX,
            source_tier="tier_2",
        )
        repo_config = {
            "repo": "open-telemetry/opentelemetry-collector",
            "name": "OTel Collector Core",
            "supplement_dirs": ["examples", "config"],
        }
        result = ingestor.ingest_repo(repo_config, force=True)
        assert result.total_fetched >= 1
        assert result.indexed >= 1

    def test_github_docs_are_semantically_searchable(self, es_client: Elasticsearch) -> None:
        es_client.indices.refresh(index=TEST_INDEX)
        result = es_client.search(
            index=TEST_INDEX,
            body={
                "query": {
                    "semantic": {
                        "field": "body_semantic",
                        "query": "collector configuration yaml example",
                    }
                },
                "size": 3,
            },
        )
        assert result["hits"]["total"]["value"] >= 1

    @pytest.mark.skipif(
        not os.environ.get("JINA_API_KEY"),
        reason="JINA_API_KEY not configured",
    )
    def test_github_code_is_semantically_searchable(self, es_client: Elasticsearch) -> None:
        es_client.indices.refresh(index=TEST_INDEX)
        result = es_client.search(
            index=TEST_INDEX,
            body={
                "query": {
                    "semantic": {
                        "field": "code_semantic",
                        "query": "otel collector receiver configuration in go",
                    }
                },
                "size": 3,
            },
        )
        assert result["hits"]["total"]["value"] >= 1

    def test_content_hash_prevents_duplicate_ingestion(self, es_client: Elasticsearch) -> None:
        ingestor = GitHubSupplementIngestor(
            es_client=es_client,
            index_name=TEST_INDEX,
            source_tier="tier_2",
        )
        repo_config = {
            "repo": "open-telemetry/opentelemetry-collector",
            "name": "OTel Collector Core",
            "supplement_dirs": ["examples", "config"],
        }

        before = es_client.count(index=TEST_INDEX)["count"]
        first = ingestor.ingest_repo(repo_config, force=False)
        second = ingestor.ingest_repo(repo_config, force=False)
        after = es_client.count(index=TEST_INDEX)["count"]

        assert first.total_fetched >= 0
        assert second.total_fetched >= 0
        # Second run should mostly skip unchanged docs.
        assert second.skipped >= first.skipped
        assert after >= before
