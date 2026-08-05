# SkillInstallRequestBody

## Example Usage

```typescript
import { SkillInstallRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: SkillInstallRequestBody = {
  name: "<value>",
};
```

## Fields

| Field                                                                                 | Type                                                                                  | Required                                                                              | Description                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `name`                                                                                | *string*                                                                              | :heavy_check_mark:                                                                    | Skill name (or name@version)                                                          |
| `target`                                                                              | [operations.SkillInstallTarget](../../../sdk/models/operations/skillinstalltarget.md) | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `agentId`                                                                             | *string*                                                                              | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `customPath`                                                                          | *string*                                                                              | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `sourcePath`                                                                          | *string*                                                                              | :heavy_minus_sign:                                                                    | Local source path                                                                     |
| `zipPath`                                                                             | *string*                                                                              | :heavy_minus_sign:                                                                    | Zip file path                                                                         |
| `version`                                                                             | *string*                                                                              | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `force`                                                                               | *boolean*                                                                             | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `registry`                                                                            | [operations.Registry](../../../sdk/models/operations/registry.md)                     | :heavy_minus_sign:                                                                    | Registry source                                                                       |