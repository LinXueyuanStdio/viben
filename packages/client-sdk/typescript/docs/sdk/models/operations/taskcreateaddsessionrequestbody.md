# TaskCreateAddSessionRequestBody

## Example Usage

```typescript
import { TaskCreateAddSessionRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateAddSessionRequestBody = {
  title: "<value>",
};
```

## Fields

| Field                    | Type                     | Required                 | Description              |
| ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| `title`                  | *string*                 | :heavy_check_mark:       | Session title (required) |
| `commit`                 | *string*                 | :heavy_minus_sign:       | Commit hash(es)          |
| `summary`                | *string*                 | :heavy_minus_sign:       | Brief summary            |
| `content`                | *string*                 | :heavy_minus_sign:       | Detailed content         |