# @viben/api-client

API client library for the Viben platform. Works in both browser and Node.js environments.

## Installation

```bash
pnpm add @viben/api-client
```

## Usage

### Basic Usage

```typescript
import { VibenClient } from '@viben/api-client';

const client = new VibenClient({
  baseUrl: 'https://viben-web.vercel.app',
  apiKey: 'viben_xxx...', // Optional for public endpoints
});

// List MCP packages
const { packages, pagination } = await client.mcp.list({ page: 1, limit: 10 });

// Search skills
const { packages: skills } = await client.skills.search('git', { type: 'command' });

// Get current user (requires API key)
const { user } = await client.user.me();
```

### Download Packages

```typescript
// Download MCP package (returns Blob)
const blob = await client.mcp.download(packageId);

// Download specific version
const blob = await client.mcp.download(packageId, '1.2.0');
```

### Workspaces

```typescript
// List workspaces
const { workspaces } = await client.workspaces.list();

// Get workspace packages
const { packages, configs } = await client.workspaces.packages(workspaceId);
```

### Social Features

```typescript
// Toggle favorite
const { favorited } = await client.mcp.toggleFavorite(packageId);

// Add comment
await client.mcp.addComment(packageId, 'Great package!');

// Rate package (1-5)
await client.mcp.rate(packageId, 5);
```

## API Reference

### VibenClient

Main client class with the following namespaced methods:

#### `client.mcp`

- `list(params?)` - List MCP packages
- `get(id)` - Get single MCP package
- `search(query, params?)` - Search MCP packages
- `download(id, version?)` - Download package as Blob
- `toggleFavorite(id)` - Toggle favorite
- `comments(id)` - Get comments
- `addComment(id, content, parentId?)` - Add comment
- `rate(id, score)` - Rate package

#### `client.skills`

Same methods as `client.mcp` but for skill packages.

#### `client.user`

- `me()` - Get current user
- `update(data)` - Update profile
- `favorites()` - List favorites
- `profile(username)` - Get public profile
- `apiKeys()` - List API keys
- `createApiKey(data)` - Create API key
- `deleteApiKey(id)` - Delete API key

#### `client.workspaces`

- `list()` - List workspaces
- `get(id)` - Get workspace
- `create(data)` - Create workspace
- `update(id, data)` - Update workspace
- `delete(id)` - Delete workspace
- `packages(id)` - Get workspace packages
- `addPackage(id, data)` - Add package to workspace
- `removePackage(id, type, entityId)` - Remove package

#### `client.collections`

- `list(params?)` - List collections
- `get(id)` - Get collection
- `create(data)` - Create collection
- `update(id, data)` - Update collection
- `delete(id)` - Delete collection
- `addItem(id, entityId, note?)` - Add item
- `removeItem(id, entityId)` - Remove item
- `fork(id)` - Fork collection

## Error Handling

```typescript
import { ApiError } from '@viben/api-client';

try {
  await client.user.me();
} catch (error) {
  if (error instanceof ApiError) {
    console.log('Status:', error.status);
    console.log('Message:', error.message);
  }
}
```

## Types

All types are exported for TypeScript users:

```typescript
import type {
  McpPackage,
  SkillPackage,
  User,
  Workspace,
  PaginatedResponse,
} from '@viben/api-client';
```

## License

MIT
