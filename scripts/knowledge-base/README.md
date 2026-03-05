# EDOT Assistant — Knowledge Base Infrastructure

This directory contains the Python scripts, configuration files, and tooling needed to build and maintain the knowledge base powering the **EDOT Assistant** embedded in the EDOT Flow Visualizer.

## Overview

The knowledge base is composed of five Elasticsearch indices populated from authoritative EDOT and OpenTelemetry sources:

| Index | Content | Ingestion Method |
|-------|---------|-----------------|
| `edot-assistant-docs-elastic` | Elastic official EDOT docs | Jina Reader |
| `edot-assistant-docs-otel` | OpenTelemetry project docs | Jina Reader |
| `edot-assistant-github-repos` | GitHub repos (markdown, issues, PRs, YAML, releases) | Elastic GitHub Connector + Supplementary Script |
| `edot-assistant-blogs` | Blog posts and tutorials | Jina Reader |
| `edot-assistant-community` | Community resources | Jina Reader |

All indices use `semantic_text` fields powered by ELSER v2 for semantic search.

## Prerequisites

- Python 3.11+
- Elastic Cloud deployment (Enterprise license for Agent Builder)
- Elastic Stack 9.x with Agent Builder enabled
- ELSER v2 inference endpoint deployed
- Jina AI API key
- GitHub personal access token (with `repo`, `user`, `read:org` scopes)

## Quick Start

### 1. Install dependencies

```bash
cd scripts/knowledge-base
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Run full setup

```bash
python -m setup.setup_all
```

This creates inference endpoints, indices, ingest pipelines, GitHub connectors, and the Agent Builder agent in one command.

### 4. Run initial ingestion

```bash
# Ingest Tier 1 (Elastic EDOT docs) — highest priority
python -m ingest.run_ingestion --tier 1

# Ingest all tiers
python -m ingest.run_ingestion --all
```

### 5. Start the refresh scheduler

```bash
python -m freshness.refresh_scheduler
```

## Directory Structure

```
scripts/knowledge-base/
├── config/                    # Configuration files
│   ├── sources.yaml           # Source registry (all 5 tiers)
│   ├── index_mappings/        # Elasticsearch index mappings
│   ├── ingest_pipelines/      # Elasticsearch ingest pipelines
│   └── agent_builder/         # Agent Builder config (prompt, tools)
├── setup/                     # One-time setup scripts
│   ├── create_inference_endpoints.py
│   ├── create_indices.py
│   ├── create_ingest_pipelines.py
│   ├── setup_agent.py
│   └── setup_all.py
├── ingest/                    # Ingestion pipelines
│   ├── base.py                # Base ingestion class
│   ├── jina_reader.py         # Web content via Jina Reader
│   ├── github_supplements.py  # YAML/releases/code from GitHub
│   ├── web_crawler_config.py  # Open Web Crawler config generator
│   └── run_ingestion.py       # CLI orchestrator
├── connectors/                # Elastic connector configuration
│   ├── github_connector_setup.py
│   └── connector_configs/
├── freshness/                 # Data freshness management
│   ├── change_detector.py
│   ├── freshness_scorer.py
│   ├── staleness_checker.py
│   └── refresh_scheduler.py
├── monitoring/                # Kibana dashboards and alerts
│   ├── kibana_dashboards/
│   └── alert_rules/
└── tests/                     # Tests and benchmarks
    ├── test_retrieval_quality.py
    └── fixtures/
```

## CLI Reference

### Ingestion

```bash
# Ingest everything
python -m ingest.run_ingestion --all

# Ingest a specific tier (1-5)
python -m ingest.run_ingestion --tier 1

# Ingest a specific source
python -m ingest.run_ingestion --source "elastic/opentelemetry"

# Dry run (preview what would be ingested)
python -m ingest.run_ingestion --tier 1 --dry-run

# Force re-ingest (ignore content hash)
python -m ingest.run_ingestion --tier 1 --force
```

### Setup

```bash
# Full setup (all steps)
python -m setup.setup_all

# Individual setup steps
python -m setup.create_inference_endpoints
python -m setup.create_indices
python -m setup.create_ingest_pipelines
python -m connectors.github_connector_setup
python -m setup.setup_agent
```

### Freshness

```bash
# Start the refresh scheduler (long-running)
python -m freshness.refresh_scheduler

# Manual freshness score update
python -m freshness.freshness_scorer

# Check for stale documents
python -m freshness.staleness_checker
```

### Testing

```bash
# Run retrieval quality benchmark
python -m pytest tests/test_retrieval_quality.py -v

# Run all tests
python -m pytest tests/ -v
```

## Source Tiers

| Tier | Sources | Refresh Cadence | Freshness Threshold |
|------|---------|----------------|-------------------|
| 1 | Elastic official EDOT docs | Every 3 days | 14 days |
| 2 | Elastic GitHub repos | Weekly | 21 days |
| 3 | OpenTelemetry project docs & repos | Weekly | 30 days |
| 4 | Elastic blogs and tutorials | Bi-weekly | 45 days |
| 5 | Community resources | Bi-weekly | 45 days |
