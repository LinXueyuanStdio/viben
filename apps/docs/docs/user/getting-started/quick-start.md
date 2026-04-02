---
sidebar_position: 2
title: "Quick Start"
description: "Get started with Viben - Agent Cluster × Code Evolution"
---

# Quick Start

This guide helps you quickly get started with Viben.

:::tip Core Concepts
Before you begin, we recommend understanding the [Core Concepts](./concepts), including FileEvo, Task System, and the differences between Agents and Executors.
:::

## Option 1: Using the Desktop Application (Recommended)

The desktop application provides a complete graphical interface, ideal for daily development use.

### Step 1: Download and Install

1. Visit [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)
2. Download the installer for your platform
3. Install and launch Viben

### Step 2: Add a Workspace

1. Click the **+** button in the sidebar
2. Select "Open Existing Folder" or "Create New Folder"
3. Follow the wizard to complete workspace configuration

### Step 3: Create a Task

1. Open the task board
2. Create a new task card
3. Set task priority and labels

### Step 4: Start Optimization

- Use FileEvo to automatically discover code improvements
- View the generated Idea list
- Convert Ideas into executable tasks

---

## Option 2: Using CLI Tools

CLI tools are suitable for automation scripts and advanced users.

:::info CLI Documentation
For complete CLI command reference, see the [CLI Documentation](/cli/).
:::

### Step 1: Install CLI

```bash
npm install -g viben
```

Or run directly:

```bash
npx viben
```

### Step 2: Initialize Developer Identity

```bash
# Check if already initialized
viben user get

# Initialize (first time use)
viben user init <your-name>
```

### Step 3: Create a Task

```bash
# Create a task
viben task create "Add user authentication" --slug auth

# View task list
viben task list
```

### Step 4: Start Task Execution

```bash
# Start task (automatically executes plan → implement → check)
viben task start auth

# Or execute in isolation using worktree
viben task start auth --worktree
```

### Step 5: Monitor Execution

```bash
# Monitor Agent status in real-time
viben swarm status --watch

# View task status
viben task view auth
```

### Step 6: Review and Complete

```bash
# Review task
viben task review auth

# Approve completion
viben task approve auth
```

---

## Option 3: Using FileEvo to Optimize Code

FileEvo automatically improves code quality through iterative optimization.

### Step 1: Generate Ideas

```bash
# Generate code improvement suggestions
viben idea generate --types code_improvements security_hardening

# View generated Ideas
viben idea list
```

### Step 2: Select and Execute

```bash
# Convert Idea to task and start
viben idea promote ci-001 --start --worktree
```

### Step 3: Monitor Optimization Loop

```bash
# View FileEvo status
viben evo status <name>

# Real-time monitoring
viben swarm status --watch
```

### Step 4: Select the Best Solution

```bash
# Select the best from multiple candidates
viben reward select <tasks...>

# Approve merge
viben task approve <task>
```

---

## Option 4: Using MCP Server

Add academic search capabilities to Claude Desktop or other AI assistants.

### Step 1: Install MCP Server

```bash
pip install browse-mcp
```

### Step 2: Configure Claude Desktop

Open the configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add configuration:

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

### Step 3: Use

Restart Claude Desktop, then try:

> "Search for the latest papers on large language models on arXiv"

---

## Quick Command Reference

### Task Management

```bash
viben task create "<title>" --slug <name>   # Create task
viben task list                              # List tasks
viben task start <task>                      # Start task
viben task approve <task>                    # Approve completion
```

### FileEvo

```bash
viben idea generate --types <types>          # Generate Ideas
viben idea promote <id> --start              # Convert Idea to task
viben evo status <name>                      # View status
viben reward select <tasks...>               # Select best
```

### Monitoring

```bash
viben swarm status --watch                   # Real-time monitoring
viben task view <task>                       # View details
```

---

## Next Steps

- [Core Concepts](./concepts) - Understand core concepts like FileEvo, Task System
- [Desktop Application Features](../desktop/features) - Explore full features
- [CLI Documentation](/cli/) - Command line tool reference
- [MCP Configuration](../mcp/configuration) - Configure API keys to enable paid data sources
