# TaskCreatePlanRequestBody

## Example Usage

```typescript
import { TaskCreatePlanRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreatePlanRequestBody = {
  name: "<value>",
  requirement: "<value>",
};
```

## Fields

| Field                                     | Type                                      | Required                                  | Description                               |
| ----------------------------------------- | ----------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| `name`                                    | *string*                                  | :heavy_check_mark:                        | Task name (required)                      |
| `requirement`                             | *string*                                  | :heavy_check_mark:                        | Requirement description (required)        |
| `platform`                                | *string*                                  | :heavy_minus_sign:                        | Platform: claude, cursor, iflow, opencode |