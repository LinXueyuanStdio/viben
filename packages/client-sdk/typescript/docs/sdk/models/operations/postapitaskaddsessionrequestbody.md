# PostApiTaskAddSessionRequestBody

## Example Usage

```typescript
import { PostApiTaskAddSessionRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskAddSessionRequestBody = {
  title: "<value>",
};
```

## Fields

| Field                    | Type                     | Required                 | Description              |
| ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| `commit`                 | *string*                 | :heavy_minus_sign:       | Commit hash(es)          |
| `content`                | *string*                 | :heavy_minus_sign:       | Detailed content         |
| `summary`                | *string*                 | :heavy_minus_sign:       | Brief summary            |
| `title`                  | *string*                 | :heavy_check_mark:       | Session title (required) |