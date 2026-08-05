# PreviewListStartSseRequest

## Example Usage

```typescript
import { PreviewListStartSseRequest } from "@viben/client-sdk/sdk/models/operations";

let value: PreviewListStartSseRequest = {
  taskId: "<id>",
  workDir: "<value>",
};
```

## Fields

| Field                                                 | Type                                                  | Required                                              | Description                                           |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `taskId`                                              | *string*                                              | :heavy_check_mark:                                    | Task identifier                                       |
| `workDir`                                             | *string*                                              | :heavy_check_mark:                                    | Working directory path                                |
| `port`                                                | *string*                                              | :heavy_minus_sign:                                    | Preferred port (optional)                             |
| `command`                                             | *string*                                              | :heavy_minus_sign:                                    | Custom command to run (e.g., 'npm run serve')         |
| `readyPattern`                                        | *string*                                              | :heavy_minus_sign:                                    | Regex pattern to detect server ready in stdout/stderr |
| `timeout`                                             | *string*                                              | :heavy_minus_sign:                                    | Startup timeout in milliseconds                       |