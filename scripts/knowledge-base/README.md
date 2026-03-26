# EDOT Assistant — Knowledge Base Infrastructure

This directory contains the ingestion, setup, and quality tooling for the EDOT Assistant knowledge base.

## Architecture

The current architecture uses:

- `Elastic Open Web Crawler` for trusted documentation/blog crawling.
- `GitHub connector + supplements script` for repository content.
- `semantic_text` fields with `jina-embeddings-v5-text-small` through EIS.

### Indices

| Index | Purpose |
|---|---|
| `edot-kb-docs` | Elastic docs, OTel docs, and trusted blogs |
| `edot-kb-github` | GitHub docs/issues/PRs + supplemental releases/YAML/code |

## Prerequisites

- Python 3.11+
- Docker (for Open Web Crawler runs)
- Elastic Cloud project (Search/Serverless recommended)
- Agent Builder access (if creating the EDOT Assistant agent)
- GitHub token with repository read permissions

## Quick Start

### 1) Install dependencies

```bash
cd scripts/knowledge-base
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Configure environment

```bash
cp .env.example .env
# Fill in ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY, GITHUB_TOKEN, and Agent Builder vars
```

### 3) One-command setup

```bash
python -m setup.setup_all
```

This creates the Jina inference endpoint, indices, ingest pipelines, connectors, and the Agent Builder agent/tools.

### 4) Ingest data

```bash
# Crawl trusted docs/blog sources
bash scripts/run_crawler.sh

# Ingest GitHub supplemental content
python -m ingest.run_ingestion --all
```

## Main Commands

### Setup

```bash
python -m setup.create_inference_endpoints
python -m setup.create_indices
python -m setup.create_ingest_pipelines
python -m connectors.github_connector_setup
python -m setup.setup_agent
```

### Ingestion

```bash
# Run crawler helper (all configs)
python -m ingest.run_ingestion --run-crawlers

# Run only selected crawler configs
python -m ingest.run_ingestion --run-crawlers --crawler-config elastic-docs.yml --crawler-config otel-docs.yml

# Ingest all GitHub supplement tiers
python -m ingest.run_ingestion --all

# Ingest a specific GitHub tier
python -m ingest.run_ingestion --tier 2

# Ingest a specific GitHub source
python -m ingest.run_ingestion --source "elastic/opentelemetry"

# Dry run
python -m ingest.run_ingestion --all --dry-run
```

### Testing

```bash
# Offline tests
python -m pytest tests/test_base_ingestor.py tests/test_github_supplements.py tests/test_freshness.py tests/test_config_validation.py -v

# Integration tests (live cluster required)
python -m pytest tests/test_inference_endpoint.py tests/test_index_lifecycle.py tests/test_github_ingestion.py -v

# Retrieval benchmark
python -m pytest tests/test_retrieval_quality.py -v

# End-to-end smoke tests
python -m pytest tests/test_e2e_smoke.py tests/test_crawler_configs.py -v
```

## Directory Layout

```text
scripts/knowledge-base/
├── config/
│   ├── sources.yaml
│   ├── index_mappings/
│   │   ├── docs.json
│   │   └── github.json
│   ├── ingest_pipelines/
│   └── agent_builder/
├── crawler-configs/
│   ├── elastic-docs.yml
│   ├── otel-docs.yml
│   └── blogs.yml
├── scripts/
│   └── run_crawler.sh
├── ingest/
│   ├── base.py
│   ├── github_supplements.py
│   └── run_ingestion.py
├── setup/
├── connectors/
├── freshness/
└── tests/
```
