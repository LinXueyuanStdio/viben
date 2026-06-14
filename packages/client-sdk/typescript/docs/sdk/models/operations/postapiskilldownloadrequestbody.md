# PostApiSkillDownloadRequestBody

## Example Usage

```typescript
import { PostApiSkillDownloadRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiSkillDownloadRequestBody = {
  name: "<value>",
  targetDir: "<value>",
};
```

## Fields

| Field               | Type                | Required            | Description         |
| ------------------- | ------------------- | ------------------- | ------------------- |
| `name`              | *string*            | :heavy_check_mark:  | Skill name or ID    |
| `targetDir`         | *string*            | :heavy_check_mark:  | Target directory    |
| `version`           | *string*            | :heavy_minus_sign:  | Version to download |