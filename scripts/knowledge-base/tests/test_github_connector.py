"""Unit tests for GitHub connector setup."""

import json
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import yaml

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from connectors import github_connector_setup as connector_setup


def test_generate_connector_configs_creates_files(tmp_path: Path) -> None:
    config_dir = tmp_path / "connector_configs"
    sources_file = tmp_path / "sources.yaml"
    sources = {
        "github_connector": {
            "edot_repos": {
                "org_name": "elastic",
                "repositories": ["elastic/opentelemetry"],
            },
            "otel_repos": {
                "repositories": ["open-telemetry/opentelemetry-collector"],
            },
        }
    }
    sources_file.write_text(yaml.safe_dump(sources), encoding="utf-8")

    with patch.object(connector_setup, "CONFIG_DIR", config_dir), patch.object(
        connector_setup, "SOURCES_FILE", sources_file
    ):
        connector_setup.generate_connector_configs()

    edot_file = config_dir / "edot_repos.json"
    otel_file = config_dir / "otel_repos.json"
    assert edot_file.exists()
    assert otel_file.exists()

    edot_config = json.loads(edot_file.read_text(encoding="utf-8"))
    assert edot_config["data_source"] == "github_cloud"
    assert edot_config["org_name"] == "elastic"
    assert "elastic/opentelemetry" in edot_config["repositories"]


def test_create_connector_registers_and_configures(tmp_path: Path) -> None:
    config_dir = tmp_path / "connector_configs"
    config_dir.mkdir(parents=True, exist_ok=True)
    cfg_path = config_dir / "edot_repos.json"
    cfg_path.write_text(
        json.dumps({"token": "${GITHUB_TOKEN}", "repositories": "elastic/opentelemetry"}),
        encoding="utf-8",
    )

    mock_es = MagicMock()
    # First request checks if connector exists (raise => not found),
    # remaining requests create + configure + scheduling.
    mock_es.perform_request.side_effect = [
        Exception("not found"),
        {"result": "created"},
        {"result": "updated"},
        {"result": "updated"},
    ]

    with patch.dict(os.environ, {"GITHUB_TOKEN": "token-123"}), patch.object(
        connector_setup, "CONFIG_DIR", config_dir
    ):
        ok = connector_setup.create_connector(
            mock_es,
            connector_id="edot-github-connector",
            index_name="edot-kb-github",
            name="EDOT GitHub Repos",
            config_file="edot_repos.json",
        )

    assert ok is True
    assert mock_es.perform_request.call_count == 4
    call_paths = [call.kwargs["path"] for call in mock_es.perform_request.call_args_list[1:]]
    assert "/_connector/edot-github-connector" in call_paths[0]
    assert "/_configuration" in call_paths[1]
    assert "/_scheduling" in call_paths[2]


def test_run_initial_sync_reports_success_when_docs_increase(tmp_path: Path) -> None:
    config_dir = tmp_path / "connector_configs"
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / "docker_config.yml").write_text("connectors: []", encoding="utf-8")

    mock_es = MagicMock()
    # start_count then first poll count
    mock_es.count.side_effect = [{"count": 0}, {"count": 3}]

    mock_run = MagicMock()
    mock_run.return_value.returncode = 0
    mock_run.return_value.stderr = ""

    with patch.object(connector_setup, "CONFIG_DIR", config_dir), patch.object(
        connector_setup, "connector_request", return_value={"status": "configured"}
    ), patch("connectors.github_connector_setup.subprocess.run", mock_run):
        ok = connector_setup.run_initial_sync(mock_es, timeout_seconds=5, poll_seconds=0)

    assert ok is True
