---
sidebar_position: 1
title: "Desktop Application"
description: "Viben Desktop Application - Agent Swarm x Code Evolution"
---

# Desktop Application

Viben Desktop is a native desktop application that achieves autonomous code iteration optimization through **Agent Swarm** and **Code Evolution**. Built with Tauri, it provides a fast, lightweight, and secure cross-platform experience.

## Core Philosophy

**Agent Swarm x Code Evolution** - Let multiple agents work collaboratively, driving continuous code evolution through FileEvo reinforcement learning.

## Core Features

### FileEvo Code Evolution

A reinforcement learning-based code iteration optimization system:

| Component | Description |
|-----------|-------------|
| **Reward Model** | Evaluates code quality and generates optimization signals |
| **Evolution Loop** | Iteratively optimizes code until objectives are met |
| **History Tracking** | Tracks code evolution history and decision processes |

### Agent Swarm Orchestration

Orchestrate multiple agents to collaboratively complete complex tasks:

| Capability | Description |
|------------|-------------|
| **Multi-Executor Support** | Claude Code, Cursor, AMP, Gemini, Codex |
| **Task Decomposition** | Break down complex tasks for different agents |
| **Collaboration Mode** | Agents share context and results |

### Task System

XState state machine-based task management:

| Status | Description |
|--------|-------------|
| `backlog` | Tasks pending planning |
| `queue` | Queued waiting for execution |
| `in_progress` | Agent is processing |
| `review` | Pending review |
| `completed` | Completed |

### Idea Generation

Automatically generate optimization suggestions from project context:
- Code refactoring suggestions
- Performance optimization solutions
- Architecture improvement ideas
- Technical debt identification

### Multi-Workspace Management

Manage multiple project workspaces, each workspace is a folder on the file system:

| Workspace Type | Description |
|----------------|-------------|
| **Global Workspace** | Exists by default, represents global configuration under `~` directory |
| **Custom Workspace** | Project directories added by users |

### MCP Server Management

Extend agent capabilities:
- Add, edit, delete MCP servers
- Configure commands, arguments, environment variables
- Enable/disable servers
- View server status

### AI Chat Interface

Converse with agents:
- Support multiple Providers (OpenAI, Anthropic, Ollama, etc.)
- Model selection and parameter configuration
- Session history management
- SSE streaming responses

## Download

[![Latest Version](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

Download from [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop).

| Platform | File Format | Size |
|----------|-------------|------|
| macOS (Universal) | `.dmg` | ~15 MB |
| Windows (x64) | `.msi` / `.exe` | ~10 MB |
| Linux (x64) | `.AppImage` / `.deb` | ~15 MB |

## System Requirements

### Minimum Requirements

| Platform | Requirements |
|----------|--------------|
| **macOS** | macOS 10.15 (Catalina) or higher |
| **Windows** | Windows 10 (64-bit) or higher |
| **Linux** | Ubuntu 20.04 or equivalent (64-bit) |

### Recommended Configuration

- 4 GB RAM
- 100 MB disk space
- Network connection

## Technical Architecture

Viben Desktop is built with modern technology stack:

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + TypeScript + Tailwind CSS 4.1 |
| **Backend** | Rust + Tauri v2 |
| **UI Components** | shadcn/ui (Radix UI) |
| **Animation** | Framer Motion |
| **Icons** | Lucide React + @lobehub/icons |
| **State Management** | Zustand + TanStack Query |
| **Local Storage** | SQLite |

### Data Storage

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/com.viben.app` |
| Windows | `%APPDATA%\com.viben.app` |
| Linux | `~/.config/viben` |

## Quick Start

1. **Download and Install**
   - Visit [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)
   - Download the installer for your platform
   - Complete installation

2. **Add Workspace**
   - Click the **+** button in the sidebar
   - Select "Open Existing Folder" or "Create New Folder"
   - Complete the wizard configuration

3. **Manage Agents**
   - Select a workspace
   - View detected agents
   - Configure MCP servers

4. **Start Using**
   - Use the kanban board to manage tasks
   - Chat with agents
   - Browse the MCP marketplace

## Next Steps

- [Installation Guide](./installation.md) - Detailed installation instructions
- [Features](./features.md) - Complete feature list
- [Quick Start](../getting-started/quick-start.md) - Get started in 2 minutes
