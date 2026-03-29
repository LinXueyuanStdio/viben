---
sidebar_position: 5
title: "Creator"
description: "Creator section for Viben Desktop - Publish packages, manage your creations, and view analytics"
---

# Creator

The Creator section in Viben Desktop provides tools for publishing and managing your packages on the Viben marketplace. This section is only visible when you are logged in.

---

## Overview

The Creator section gives you access to:

| Feature | Description |
|---------|-------------|
| **Publish** | Package publish wizard for sharing your work |
| **My Packages** | View and manage your published packages |
| **Analytics** | Download statistics and usage data |

---

## Accessing Creator

The Creator section appears in the sidebar when you are logged in:

1. Sign in to your Viben account
2. Look for the **Creator** section in the sidebar
3. Click any item to navigate to that feature

:::info
If you are not logged in, the Creator section will be hidden. Sign in to access publishing features.
:::

---

## Publish

The Publish page provides a wizard for packaging and publishing your work.

### What You Can Publish

| Package Type | Description |
|--------------|-------------|
| **MCP Servers** | Model Context Protocol servers |
| **Skills** | Reusable capability packages for agents |
| **Agents** | Pre-configured agent definitions |

### Publishing Steps

1. **Select Package** - Choose what to publish from your workspace
2. **Configure Metadata** - Set name, description, version, tags
3. **Preview** - Review the package before publishing
4. **Submit** - Publish to the marketplace

### Best Practices

- Write clear, descriptive names and descriptions
- Include usage examples in your README
- Use semantic versioning (e.g., 1.0.0, 1.1.0, 2.0.0)
- Add relevant tags to help users find your package

---

## My Packages

The My Packages page lists all packages you have published.

### Package Management

From this page you can:

- **View details** - See package metadata and statistics
- **Edit** - Update description, tags, and other metadata
- **Deprecate** - Mark a package as deprecated
- **Delete** - Remove a package (with confirmation)

### Package Status

| Status | Description |
|--------|-------------|
| **Published** | Available on the marketplace |
| **Draft** | Not yet published, still in progress |
| **Deprecated** | Marked as no longer maintained |

---

## Analytics

The Analytics page shows statistics for your published packages.

### Available Metrics

| Metric | Description |
|--------|-------------|
| **Downloads** | Total download count |
| **Favorites** | Number of users who favorited |
| **Trend** | Download trend over time |

### Time Ranges

View analytics for different periods:
- Last 7 days
- Last 30 days
- Last 90 days
- All time

### Understanding Your Data

Use analytics to:
- Track package popularity
- Identify usage patterns
- Plan future updates based on demand

---

## Collapsed Mode

In collapsed sidebar mode:

- Creator items show as icon buttons
- Hover over icons to see tooltips
- Click icons to navigate

| Icon | Feature |
|------|---------|
| Upload | Publish |
| PackageSearch | My Packages |
| BarChart3 | Analytics |

---

## API Integration

Creator features interact with the Viben web API:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/users/me/packages` | List your published packages |
| `GET /api/users/me/favorites` | List your favorites |
| `GET /api/analytics/downloads` | Download statistics |

Authentication is handled automatically when you are signed in.

---

## Related Documentation

- [Features](./features.md) - Complete feature list
- [MCP Marketplace](/user/mcp/configuration) - Browse and install packages
- [Skills Management](./features.md#skills-management) - Manage skills
