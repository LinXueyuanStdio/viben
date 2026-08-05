# AgentListRequest

## Example Usage

```typescript
import { AgentListRequest } from "@viben/client-sdk/sdk/models/operations";

let value: AgentListRequest = {};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `workspacePath`                            | *string*                                   | :heavy_minus_sign:                         | Workspace path to include workspace agents |
| `includeGlobal`                            | *string*                                   | :heavy_minus_sign:                         | Include global agents (default: true)      |