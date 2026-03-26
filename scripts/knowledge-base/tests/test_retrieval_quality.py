"""Retrieval quality benchmark for the EDOT Assistant knowledge base.

Runs 50 benchmark Q&A pairs against the knowledge base indices and
measures retrieval accuracy. Target: >85% of questions should have
at least one of the expected keywords in the top-3 results.

Usage:
    python -m pytest tests/test_retrieval_quality.py -v
    python -m pytest tests/test_retrieval_quality.py -v --benchmark-report
"""

import json
import logging
import os
import time
from pathlib import Path

import pytest
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

FIXTURES_DIR = Path(__file__).parent / "fixtures"
BENCHMARK_FILE = FIXTURES_DIR / "benchmark_questions.json"
TOP_K = 3
TARGET_ACCURACY = 0.85
TARGET_MRR = 0.60
TARGET_AVG_LATENCY_SECONDS = 2.0
VALID_SEARCH_FIELDS = {"body_semantic", "code_semantic", "both"}

INDEX_MIGRATION_MAP = {
    "edot-assistant-docs-elastic": "edot-kb-docs",
    "edot-assistant-docs-otel": "edot-kb-docs",
    "edot-assistant-blogs": "edot-kb-docs",
    "edot-assistant-community": "edot-kb-docs",
    "edot-assistant-github-repos": "edot-kb-github",
}


def get_es_client() -> Elasticsearch:
    """Create an Elasticsearch client from environment variables."""
    url = os.environ.get("ELASTICSEARCH_URL")
    api_key = os.environ.get("ELASTICSEARCH_API_KEY")
    if not url or not api_key:
        pytest.skip("ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY not set")
    return Elasticsearch(url, api_key=api_key)


def load_benchmark_questions() -> list[dict]:
    """Load the benchmark Q&A pairs from JSON fixture."""
    with open(BENCHMARK_FILE, "r") as f:
        questions = json.load(f)
    for question in questions:
        question.setdefault("search_field", "body_semantic")
    return questions


def semantic_search(
    es: Elasticsearch,
    index: str,
    query: str,
    search_field: str = "body_semantic",
    top_k: int = TOP_K,
) -> list[dict]:
    """Run a semantic search query against an index."""
    if search_field not in VALID_SEARCH_FIELDS:
        raise ValueError(f"Unsupported search field: {search_field}")

    if search_field == "both":
        query_body = {
            "bool": {
                "should": [
                    {"semantic": {"field": "body_semantic", "query": query}},
                    {"semantic": {"field": "code_semantic", "query": query}},
                ],
                "minimum_should_match": 1,
            }
        }
    else:
        query_body = {
            "semantic": {
                "field": search_field,
                "query": query,
            }
        }

    try:
        result = es.search(
            index=index,
            body={
                "query": query_body,
                "size": top_k,
                "_source": ["title", "body", "url", "content_type", "tags"],
            },
        )
        return [
            {
                "title": hit["_source"].get("title", ""),
                "body": hit["_source"].get("body", "")[:500],
                "url": hit["_source"].get("url", ""),
                "score": hit["_score"],
            }
            for hit in result["hits"]["hits"]
        ]
    except Exception as e:
        logger.error("Search error for index %s: %s", index, e)
        return []


def check_keywords(results: list[dict], expected_keywords: list[str]) -> bool:
    """Check if any of the expected keywords appear in the top results."""
    combined_text = " ".join(
        f"{r['title']} {r['body']}" for r in results
    ).lower()
    return any(kw.lower() in combined_text for kw in expected_keywords)


def reciprocal_rank(results: list[dict], expected_keywords: list[str]) -> float:
    """Compute reciprocal rank of first relevant result."""
    expected = [kw.lower() for kw in expected_keywords]
    for rank, result in enumerate(results, start=1):
        text = f"{result.get('title', '')} {result.get('body', '')}".lower()
        if any(keyword in text for keyword in expected):
            return 1.0 / rank
    return 0.0


def normalize_indices(indices: list[str]) -> list[str]:
    """Map legacy benchmark index names to the new consolidated indices."""
    mapped = [INDEX_MIGRATION_MAP.get(index, index) for index in indices]
    # Keep order while de-duplicating.
    return list(dict.fromkeys(mapped))


class TestRetrievalQuality:
    """Test suite for retrieval quality benchmarking."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up Elasticsearch client and benchmark data."""
        self.es = get_es_client()
        self.questions = load_benchmark_questions()

    def test_benchmark_file_exists(self):
        """Verify the benchmark file exists and has 50 questions."""
        assert BENCHMARK_FILE.exists(), f"Benchmark file not found: {BENCHMARK_FILE}"
        assert len(self.questions) >= 50, f"Expected 50+ questions, got {len(self.questions)}"

    def test_questions_have_required_fields(self):
        """Verify each question has the required fields."""
        for q in self.questions:
            assert "id" in q, f"Missing 'id' in question: {q}"
            assert "question" in q, f"Missing 'question' in: {q['id']}"
            assert "expected_keywords" in q, f"Missing 'expected_keywords' in: {q['id']}"
            assert "expected_indices" in q, f"Missing 'expected_indices' in: {q['id']}"
            assert "search_field" in q, f"Missing 'search_field' in: {q['id']}"
            assert q["search_field"] in VALID_SEARCH_FIELDS, (
                f"Invalid search_field '{q['search_field']}' in: {q['id']}"
            )
            assert len(q["expected_keywords"]) > 0, f"Empty keywords in: {q['id']}"

    def test_categories_are_balanced(self):
        """Verify the benchmark covers all required categories."""
        categories = {}
        for q in self.questions:
            cat = q.get("category", "unknown")
            categories[cat] = categories.get(cat, 0) + 1

        expected_categories = {
            "collector_configuration": 15,
            "sdk_instrumentation": 15,
            "architecture_patterns": 10,
            "version_compatibility": 5,
            "troubleshooting": 5,
        }

        for cat, expected_count in expected_categories.items():
            actual = categories.get(cat, 0)
            assert actual >= expected_count, (
                f"Category '{cat}' has {actual} questions, expected {expected_count}"
            )

    def require_benchmark_indices(self) -> None:
        """Skip live quality tests when benchmark indices are missing."""
        try:
            required_indices = sorted({
                index
                for question in self.questions
                for index in normalize_indices(question["expected_indices"])
            })
            missing = [
                index
                for index in required_indices
                if not self.es.indices.exists(index=index)
            ]
        except Exception as exc:
            pytest.skip(f"Skipping live retrieval benchmarks; Elasticsearch unavailable: {exc}")

        if missing:
            pytest.skip(
                "Missing benchmark indices in cluster: "
                + ", ".join(missing)
                + ". Run index setup and ingestion before retrieval benchmarks."
            )

    @pytest.mark.skipif(
        not os.environ.get("ELASTICSEARCH_URL"),
        reason="Elasticsearch not configured",
    )
    def test_overall_retrieval_accuracy(self):
        """Run all benchmark questions and verify >85% accuracy."""
        self.require_benchmark_indices()
        results_log = []
        correct = 0
        total = len(self.questions)
        mrr_values = []
        latencies = []
        field_stats = {
            "body_semantic": {"correct": 0, "total": 0},
            "code_semantic": {"correct": 0, "total": 0},
            "both": {"correct": 0, "total": 0},
        }

        for q in self.questions:
            question = q["question"]
            expected_keywords = q["expected_keywords"]
            expected_indices = normalize_indices(q["expected_indices"])
            search_field = q.get("search_field", "body_semantic")
            field_stats[search_field]["total"] += 1

            # Search across all expected indices
            all_results = []
            started = time.perf_counter()
            for index in expected_indices:
                results = semantic_search(self.es, index, question, search_field=search_field)
                all_results.extend(results)
            latencies.append(time.perf_counter() - started)

            # Sort by score and take top-K
            all_results.sort(key=lambda r: r.get("score", 0), reverse=True)
            top_results = all_results[:TOP_K]

            # Check keywords
            found = check_keywords(top_results, expected_keywords)
            rr = reciprocal_rank(top_results, expected_keywords)
            mrr_values.append(rr)
            if found:
                correct += 1
                field_stats[search_field]["correct"] += 1

            results_log.append({
                "id": q["id"],
                "question": question[:80],
                "found": found,
                "field": search_field,
                "top_result": top_results[0]["title"] if top_results else "No results",
            })

        accuracy = correct / total if total > 0 else 0
        mrr = sum(mrr_values) / len(mrr_values) if mrr_values else 0.0
        avg_latency = sum(latencies) / len(latencies) if latencies else 0.0

        # Print detailed report
        table = Table(
            title=(
                f"Retrieval Quality Report ({correct}/{total} = {accuracy:.1%}) "
                f"| MRR={mrr:.3f} | avg_latency={avg_latency:.2f}s"
            )
        )
        table.add_column("ID", style="cyan")
        table.add_column("Question")
        table.add_column("Field")
        table.add_column("Found", style="bold")
        table.add_column("Top Result")

        for r in results_log:
            status = "[green]Yes[/green]" if r["found"] else "[red]No[/red]"
            table.add_row(r["id"], r["question"], r["field"], status, r["top_result"][:50])

        console.print(table)

        field_table = Table(title="Per-field Accuracy")
        field_table.add_column("Field", style="cyan")
        field_table.add_column("Correct", justify="right")
        field_table.add_column("Total", justify="right")
        field_table.add_column("Accuracy", justify="right")
        for field_name, stats in field_stats.items():
            total_for_field = stats["total"]
            accuracy_for_field = (
                (stats["correct"] / total_for_field) if total_for_field else 0.0
            )
            field_table.add_row(
                field_name,
                str(stats["correct"]),
                str(total_for_field),
                f"{accuracy_for_field:.1%}",
            )
        console.print(field_table)

        assert accuracy >= TARGET_ACCURACY, (
            f"Retrieval accuracy {accuracy:.1%} is below target {TARGET_ACCURACY:.0%}. "
            f"Got {correct}/{total} correct."
        )
        assert mrr >= TARGET_MRR, (
            f"MRR {mrr:.3f} is below target {TARGET_MRR:.2f}."
        )
        assert avg_latency <= TARGET_AVG_LATENCY_SECONDS, (
            f"Average latency {avg_latency:.2f}s exceeds {TARGET_AVG_LATENCY_SECONDS:.2f}s."
        )

    @pytest.mark.skipif(
        not os.environ.get("ELASTICSEARCH_URL"),
        reason="Elasticsearch not configured",
    )
    @pytest.mark.parametrize("category", [
        "collector_configuration",
        "sdk_instrumentation",
        "architecture_patterns",
        "version_compatibility",
        "troubleshooting",
    ])
    def test_category_accuracy(self, category: str):
        """Test retrieval accuracy per category."""
        self.require_benchmark_indices()
        category_questions = [q for q in self.questions if q.get("category") == category]
        if not category_questions:
            pytest.skip(f"No questions for category: {category}")

        correct = 0
        for q in category_questions:
            all_results = []
            search_field = q.get("search_field", "body_semantic")
            for index in normalize_indices(q["expected_indices"]):
                results = semantic_search(
                    self.es,
                    index,
                    q["question"],
                    search_field=search_field,
                )
                all_results.extend(results)

            all_results.sort(key=lambda r: r.get("score", 0), reverse=True)
            top_results = all_results[:TOP_K]

            if check_keywords(top_results, q["expected_keywords"]):
                correct += 1

        accuracy = correct / len(category_questions)
        logger.info(
            "Category '%s': %d/%d = %.1f%%",
            category, correct, len(category_questions), accuracy * 100,
        )

        # Categories should have at least 70% accuracy individually
        assert accuracy >= 0.70, (
            f"Category '{category}' accuracy {accuracy:.1%} is below 70%"
        )
