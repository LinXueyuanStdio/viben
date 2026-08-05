# SkillDownloadRequestBody

## Example Usage

```typescript
import { SkillDownloadRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: SkillDownloadRequestBody = {
  name: "<value>",
  targetDir: "<value>",
};
```

## Fields

| Field               | Type                | Required            | Description         |
| ------------------- | ------------------- | ------------------- | ------------------- |
| `name`              | *string*            | :heavy_check_mark:  | Skill name or ID    |
| `version`           | *string*            | :heavy_minus_sign:  | Version to download |
| `targetDir`         | *string*            | :heavy_check_mark:  | Target directory    |