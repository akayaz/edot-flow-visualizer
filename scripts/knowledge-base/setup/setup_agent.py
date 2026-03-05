"""Create or update the EDOT Assistant agent in Elastic Agent Builder.

Reads the system prompt and tool definitions from config/agent_builder/
and registers them via the Agent Builder REST API.

Usage:
    python -m setup.setup_agent
"""

import json
import os
import sys
import logging
from pathlib import Path

import click
import requests
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

AGENT_CONFIG_DIR = Path(__file__).parent.parent / "config" / "agent_builder"
TOOLS_DIR = AGENT_CONFIG_DIR / "tools"


def get_agent_builder_config() -> tuple[str, str]:
    """Get Agent Builder URL and API key from environment."""
    url = os.environ.get("AGENT_BUILDER_URL")
    api_key = os.environ.get("AGENT_BUILDER_API_KEY")
    if not url or not api_key:
        console.print(
            "[red]Error:[/red] AGENT_BUILDER_URL and AGENT_BUILDER_API_KEY "
            "must be set in environment or .env file."
        )
        sys.exit(1)
    return url, api_key


def load_system_prompt() -> str:
    """Load the system prompt from file."""
    prompt_path = AGENT_CONFIG_DIR / "system_prompt.md"
    with open(prompt_path, "r") as f:
        return f.read()


def load_agent_config() -> dict:
    """Load the agent configuration."""
    config_path = AGENT_CONFIG_DIR / "agent_config.json"
    with open(config_path, "r") as f:
        return json.load(f)


def load_tool_definitions() -> list[dict]:
    """Load all tool definitions from the tools directory."""
    tools = []
    for tool_file in sorted(TOOLS_DIR.glob("*.json")):
        with open(tool_file, "r") as f:
            tool = json.load(f)
            tools.append(tool)
    return tools


def create_agent(base_url: str, api_key: str) -> str:
    """Create or update the EDOT Assistant agent.

    Returns the agent ID.
    """
    console.print("\n[bold]Creating EDOT Assistant agent...[/bold]")

    system_prompt = load_system_prompt()
    agent_config = load_agent_config()

    payload = {
        "name": agent_config["name"],
        "description": agent_config["description"],
        "system_prompt": system_prompt,
    }

    if "settings" in agent_config:
        payload["settings"] = agent_config["settings"]

    try:
        response = requests.post(
            f"{base_url}/api/agent_builder/agents",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"ApiKey {api_key}",
            },
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        result = response.json()
        agent_id = result.get("id", "unknown")
        console.print(f"  [green]Agent created.[/green] ID: {agent_id}")
        return agent_id
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 409:
            console.print("  [yellow]Agent already exists. Updating...[/yellow]")
            # Try to get existing agent
            try:
                list_response = requests.get(
                    f"{base_url}/api/agent_builder/agents",
                    headers={"Authorization": f"ApiKey {api_key}"},
                    timeout=30,
                )
                list_response.raise_for_status()
                agents = list_response.json().get("agents", [])
                for agent in agents:
                    if agent.get("name") == agent_config["name"]:
                        agent_id = agent["id"]
                        # Update
                        update_response = requests.put(
                            f"{base_url}/api/agent_builder/agents/{agent_id}",
                            headers={
                                "Content-Type": "application/json",
                                "Authorization": f"ApiKey {api_key}",
                            },
                            json=payload,
                            timeout=30,
                        )
                        update_response.raise_for_status()
                        console.print(f"  [green]Agent updated.[/green] ID: {agent_id}")
                        return agent_id
            except Exception as update_err:
                console.print(f"  [red]Update failed:[/red] {update_err}")
        console.print(f"  [red]Failed:[/red] {e}")
        return ""
    except Exception as e:
        console.print(f"  [red]Failed:[/red] {e}")
        return ""


def register_tools(base_url: str, api_key: str, agent_id: str) -> int:
    """Register all tools for the agent.

    Returns the number of successfully registered tools.
    """
    console.print("\n[bold]Registering agent tools...[/bold]")
    tools = load_tool_definitions()
    success_count = 0

    for tool in tools:
        tool_id = tool.get("id", "unknown")
        console.print(f"  Registering: {tool_id}")
        try:
            response = requests.post(
                f"{base_url}/api/agent_builder/agents/{agent_id}/tools",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"ApiKey {api_key}",
                },
                json=tool,
                timeout=30,
            )
            response.raise_for_status()
            console.print(f"    [green]OK[/green]")
            success_count += 1
        except Exception as e:
            console.print(f"    [red]Failed:[/red] {e}")

    return success_count


def verify_agent(base_url: str, api_key: str, agent_id: str) -> None:
    """Verify the agent is functional with a test query."""
    console.print("\n[bold]Verifying agent with test query...[/bold]")
    try:
        response = requests.post(
            f"{base_url}/api/agent_builder/chat/{agent_id}",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"ApiKey {api_key}",
            },
            json={
                "messages": [
                    {"role": "user", "content": "What is EDOT?"}
                ]
            },
            timeout=60,
        )
        response.raise_for_status()
        result = response.json()
        content = result.get("messages", [{}])[-1].get("content", "")
        preview = content[:200] + "..." if len(content) > 200 else content
        console.print(f"  [green]Agent responded:[/green] {preview}")
    except Exception as e:
        console.print(f"  [yellow]Verification failed (agent may still be initializing):[/yellow] {e}")


@click.command()
@click.option("--verify-only", is_flag=True, help="Only verify the existing agent.")
@click.option("--skip-verify", is_flag=True, help="Skip the test query verification.")
def main(verify_only: bool, skip_verify: bool) -> None:
    """Create or update the EDOT Assistant agent in Agent Builder."""
    console.print("[bold blue]EDOT Assistant — Agent Builder Setup[/bold blue]")

    base_url, api_key = get_agent_builder_config()
    console.print(f"Agent Builder URL: {base_url}")

    if verify_only:
        # List agents
        try:
            response = requests.get(
                f"{base_url}/api/agent_builder/agents",
                headers={"Authorization": f"ApiKey {api_key}"},
                timeout=30,
            )
            response.raise_for_status()
            agents = response.json().get("agents", [])

            table = Table(title="Agent Builder Agents")
            table.add_column("Name", style="cyan")
            table.add_column("ID")
            table.add_column("Tools", justify="right")

            for agent in agents:
                table.add_row(
                    agent.get("name", "unknown"),
                    agent.get("id", "unknown"),
                    str(len(agent.get("tools", []))),
                )
            console.print(table)
        except Exception as e:
            console.print(f"[red]Failed to list agents:[/red] {e}")
        return

    # Create agent
    agent_id = create_agent(base_url, api_key)
    if not agent_id:
        console.print("[red]Agent creation failed. Cannot continue.[/red]")
        sys.exit(1)

    # Register tools
    tool_count = register_tools(base_url, api_key, agent_id)
    total_tools = len(list(TOOLS_DIR.glob("*.json")))
    console.print(f"\n  Tools registered: {tool_count}/{total_tools}")

    # Verify
    if not skip_verify:
        verify_agent(base_url, api_key, agent_id)

    # Output summary
    console.print(f"\n[green]Agent setup complete.[/green]")
    console.print(f"  Agent ID: {agent_id}")
    console.print(f"  MCP Server: {base_url}/api/agent_builder/mcp")
    console.print(f"  Chat API:   {base_url}/api/agent_builder/chat/{agent_id}")


if __name__ == "__main__":
    main()
