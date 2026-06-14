# PostApiTaskPlanRequestBody

## Example Usage

```typescript
import { PostApiTaskPlanRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskPlanRequestBody = {
  name: "<value>",
  requirement: "<value>",
};
```

## Fields

| Field                                     | Type                                      | Required                                  | Description                               |
| ----------------------------------------- | ----------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| `name`                                    | *string*                                  | :heavy_check_mark:                        | Task name (required)                      |
| `platform`                                | *string*                                  | :heavy_minus_sign:                        | Platform: claude, cursor, iflow, opencode |
| `requirement`                             | *string*                                  | :heavy_check_mark:                        | Requirement description (required)        |