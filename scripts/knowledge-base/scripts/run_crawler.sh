#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KB_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_DIR="${KB_ROOT}/crawler-configs"
CRAWLER_IMAGE="${CRAWLER_IMAGE:-docker.elastic.co/integrations/crawler:latest}"

DRY_RUN=false
CONFIGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      CONFIGS+=("$2")
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ${#CONFIGS[@]} -eq 0 ]]; then
  CONFIGS=("elastic-docs.yml" "otel-docs.yml" "blogs.yml")
fi

# Open Crawler configs use ES_HOST/ES_API_KEY placeholders.
if [[ -z "${ES_HOST:-}" && -n "${ELASTICSEARCH_URL:-}" ]]; then
  export ES_HOST="${ELASTICSEARCH_URL}"
fi

if [[ -z "${ES_API_KEY:-}" && -n "${ELASTICSEARCH_API_KEY:-}" ]]; then
  export ES_API_KEY="${ELASTICSEARCH_API_KEY}"
fi

if [[ -z "${ES_HOST:-}" || -z "${ES_API_KEY:-}" ]]; then
  echo "Missing ES_HOST/ES_API_KEY (or ELASTICSEARCH_URL/ELASTICSEARCH_API_KEY)." >&2
  exit 1
fi

for config_name in "${CONFIGS[@]}"; do
  config_path="${CONFIG_DIR}/${config_name}"
  if [[ ! -f "${config_path}" ]]; then
    echo "Crawler config not found: ${config_path}" >&2
    exit 1
  fi

  cmd=(
    docker run --rm
    -e "ES_HOST=${ES_HOST}"
    -e "ES_API_KEY=${ES_API_KEY}"
    -v "${CONFIG_DIR}:/config"
    "${CRAWLER_IMAGE}"
    jruby bin/crawler crawl "/config/${config_name}"
  )

  echo ""
  echo "Running crawler config: ${config_name}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "DRY RUN: ${cmd[*]}"
    continue
  fi

  "${cmd[@]}"
done

echo ""
echo "Crawler execution complete."
