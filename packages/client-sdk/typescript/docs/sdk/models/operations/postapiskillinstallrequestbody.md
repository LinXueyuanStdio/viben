# PostApiSkillInstallRequestBody

## Example Usage

```typescript
import { PostApiSkillInstallRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiSkillInstallRequestBody = {
  name: "<value>",
};
```

## Fields

| Field                                                                                               | Type                                                                                                | Required                                                                                            | Description                                                                                         |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `agentId`                                                                                           | *string*                                                                                            | :heavy_minus_sign:                                                                                  | N/A                                                                                                 |
| `customPath`                                                                                        | *string*                                                                                            | :heavy_minus_sign:                                                                                  | N/A                                                                                                 |
| `force`                                                                                             | *boolean*                                                                                           | :heavy_minus_sign:                                                                                  | N/A                                                                                                 |
| `name`                                                                                              | *string*                                                                                            | :heavy_check_mark:                                                                                  | Skill name (or name@version)                                                                        |
| `sourcePath`                                                                                        | *string*                                                                                            | :heavy_minus_sign:                                                                                  | Local source path                                                                                   |
| `target`                                                                                            | [operations.PostApiSkillInstallTarget](../../../sdk/models/operations/postapiskillinstalltarget.md) | :heavy_minus_sign:                                                                                  | N/A                                                                                                 |
| `version`                                                                                           | *string*                                                                                            | :heavy_minus_sign:                                                                                  | N/A                                                                                                 |
| `zipPath`                                                                                           | *string*                                                                                            | :heavy_minus_sign:                                                                                  | Zip file path                                                                                       |