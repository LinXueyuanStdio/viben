# McpInstallRequestBody

## Example Usage

```typescript
import { McpInstallRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: McpInstallRequestBody = {
  spec: "<value>",
};
```

## Fields

| Field                                                         | Type                                                          | Required                                                      | Description                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `spec`                                                        | *string*                                                      | :heavy_check_mark:                                            | Install spec (name, name@version, gh:user/repo, ./path)       |
| `target`                                                      | [operations.Target](../../../sdk/models/operations/target.md) | :heavy_minus_sign:                                            | N/A                                                           |
| `force`                                                       | *boolean*                                                     | :heavy_minus_sign:                                            | Force reinstall                                               |