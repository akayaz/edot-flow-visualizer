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
        return json.load(f)


def semantic_search(es: Elasticsearch, index: str, query: str, top_k: int = TOP_K) -> list[dict]:
    """Run a semantic search query against an index."""
    try:
        result = es.search(
            index=index,
            body={
                "query": {
                    "semantic": {
                        "field": "body_semantic",
                        "query": query,
                    }
                },
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

    @pytest.mark.skipif(
        not os.environ.get("ELASTICSEARCH_URL"),
        reason="Elasticsearch not configured",
    )
    def test_overall_retrieval_accuracy(self):
        """Run all benchmark questions and verify >85% accuracy."""
        results_log = []
        correct = 0
        total = len(self.questions)

        for q in self.questions:
            question = q["question"]
            expected_keywords = q["expected_keywords"]
            expected_indices = q["expected_indices"]

            # Search across all expected indices
            all_results = []
            for index in expected_indices:
                results = semantic_search(self.es, index, question)
                all_results.extend(results)

            # Sort by score and take top-K
            all_results.sort(key=lambda r: r.get("score", 0), reverse=True)
            top_results = all_results[:TOP_K]

            # Check keywords
            found = check_keywords(top_results, expected_keywords)
            if found:
                correct += 1

            results_log.append({
                "id": q["id"],
                "question": question[:80],
                "found": found,
                "top_result": top_results[0]["title"] if top_results else "No results",
            })

        accuracy = correct / total if total > 0 else 0

        # Print detailed report
        table = Table(title=f"Retrieval Quality Report ({correct}/{total} = {accuracy:.1%})")
        table.add_column("ID", style="cyan")
        table.add_column("Question")
        table.add_column("Found", style="bold")
        table.add_column("Top Result")

        for r in results_log:
            status = "[green]Yes[/green]" if r["found"] else "[red]No[/red]"
            table.add_row(r["id"], r["question"], status, r["top_result"][:50])

        console.print(table)

        assert accuracy >= TARGET_ACCURACY, (
            f"Retrieval accuracy {accuracy:.1%} is below target {TARGET_ACCURACY:.0%}. "
            f"Got {correct}/{total} correct."
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
        category_questions = [q for q in self.questions if q.get("category") == category]
        if not category_questions:
            pytest.skip(f"No questions for category: {category}")

        correct = 0
        for q in category_questions:
            all_results = []
            for index in q["expected_indices"]:
                results = semantic_search(self.es, index, q["question"])
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
