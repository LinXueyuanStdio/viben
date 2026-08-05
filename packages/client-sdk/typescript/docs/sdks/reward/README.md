# Reward

## Overview

### Available Operations

* [listTypes](#listtypes) - List available reward types (builtin + custom)
* [createType](#createtype) - Create a new custom reward type
* [getType](#gettype) - Get a specific reward type by name
* [updateType](#updatetype) - Update a custom reward type
* [deleteType](#deletetype) - Delete a custom reward type
* [compute](#compute) - Compute reward for a task by spawning the reward agent
* [select](#select) - Select best task using PPO metrics

## listTypes

List available reward types (builtin + custom)

### Example Usage

<!-- UsageSnippet language="typescript" operationID="reward_listTypes" method="get" path="/api/reward/types" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.reward.listTypes({
    workspacePath: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { rewardListTypes } from "@viben/client-sdk/funcs/rewardListTypes.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await rewardListTypes(vibenClient, {
    workspacePath: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("rewardListTypes failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.RewardListTypesRequest](../../sdk/models/operations/rewardlisttypesrequest.md)                                                                                     | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.RewardListTypesResponse](../../sdk/models/operations/rewardlisttypesresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## createType

Create a new custom reward type

### Example Usage

<!-- UsageSnippet language="typescript" operationID="reward_createType" method="post" path="/api/reward/types" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.reward.createType({
    workspacePath: "<value>",
    name: "<value>",
    description: "pecan fog voluntarily than where",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { rewardCreateType } from "@viben/client-sdk/funcs/rewardCreateType.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await rewardCreateType(vibenClient, {
    workspacePath: "<value>",
    name: "<value>",
    description: "pecan fog voluntarily than where",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("rewardCreateType failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.RewardCreateTypeRequestBody](../../sdk/models/operations/rewardcreatetyperequestbody.md)                                                                           | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.RewardCreateTypeResponse](../../sdk/models/operations/rewardcreatetyperesponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## getType

Get a specific reward type by name

### Example Usage

<!-- UsageSnippet language="typescript" operationID="reward_getType" method="get" path="/api/reward/types/{name}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.reward.getType({
    workspacePath: "<value>",
    name: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { rewardGetType } from "@viben/client-sdk/funcs/rewardGetType.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await rewardGetType(vibenClient, {
    workspacePath: "<value>",
    name: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("rewardGetType failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.RewardGetTypeRequest](../../sdk/models/operations/rewardgettyperequest.md)                                                                                         | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.RewardGetTypeResponse](../../sdk/models/operations/rewardgettyperesponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## updateType

Update a custom reward type

### Example Usage

<!-- UsageSnippet language="typescript" operationID="reward_updateType" method="put" path="/api/reward/types/{name}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.reward.updateType({
    name: "<value>",
    requestBody: {
      workspacePath: "<value>",
    },
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { rewardUpdateType } from "@viben/client-sdk/funcs/rewardUpdateType.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await rewardUpdateType(vibenClient, {
    name: "<value>",
    requestBody: {
      workspacePath: "<value>",
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("rewardUpdateType failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.RewardUpdateTypeRequest](../../sdk/models/operations/rewardupdatetyperequest.md)                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.RewardUpdateTypeResponse](../../sdk/models/operations/rewardupdatetyperesponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## deleteType

Delete a custom reward type

### Example Usage

<!-- UsageSnippet language="typescript" operationID="reward_deleteType" method="delete" path="/api/reward/types/{name}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.reward.deleteType({
    workspacePath: "<value>",
    name: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { rewardDeleteType } from "@viben/client-sdk/funcs/rewardDeleteType.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await rewardDeleteType(vibenClient, {
    workspacePath: "<value>",
    name: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("rewardDeleteType failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.RewardDeleteTypeRequest](../../sdk/models/operations/rewarddeletetyperequest.md)                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.RewardDeleteTypeResponse](../../sdk/models/operations/rewarddeletetyperesponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## compute

Compute reward for a task by spawning the reward agent

### Example Usage

<!-- UsageSnippet language="typescript" operationID="reward_compute" method="post" path="/api/reward/compute" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.reward.compute({
    workspacePath: "<value>",
    task: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { rewardCompute } from "@viben/client-sdk/funcs/rewardCompute.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await rewardCompute(vibenClient, {
    workspacePath: "<value>",
    task: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("rewardCompute failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.RewardComputeRequestBody](../../sdk/models/operations/rewardcomputerequestbody.md)                                                                                 | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.RewardComputeResponse](../../sdk/models/operations/rewardcomputeresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## select

Select best task using PPO metrics

### Example Usage

<!-- UsageSnippet language="typescript" operationID="reward_select" method="post" path="/api/reward/select" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.reward.select({
    workspacePath: "<value>",
    tasks: [
      "<value 1>",
    ],
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { rewardSelect } from "@viben/client-sdk/funcs/rewardSelect.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await rewardSelect(vibenClient, {
    workspacePath: "<value>",
    tasks: [
      "<value 1>",
    ],
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("rewardSelect failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.RewardSelectRequestBody](../../sdk/models/operations/rewardselectrequestbody.md)                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.RewardSelectResponse](../../sdk/models/operations/rewardselectresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |