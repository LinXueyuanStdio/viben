# Workspaces

## Overview

Workspace management

### Available Operations

* [list](#list) - List all workspaces including the global workspace
* [detect](#detect) - Detect folder status (.git and .viben directories)
* [createCreate](#createcreate)
* [delete](#delete)

## list

List all workspaces including the global workspace

### Example Usage

<!-- UsageSnippet language="typescript" operationID="workspaces_list" method="get" path="/api/workspaces" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.workspaces.list();

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { workspacesList } from "@viben/client-sdk/funcs/workspacesList.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await workspacesList(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("workspacesList failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.WorkspacesListResponseBody](../../sdk/models/operations/workspaceslistresponsebody.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## detect

Detect folder status (.git and .viben directories)

### Example Usage

<!-- UsageSnippet language="typescript" operationID="workspaces_detect" method="get" path="/api/workspaces/detect" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.workspaces.detect({
    path: "/media",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { workspacesDetect } from "@viben/client-sdk/funcs/workspacesDetect.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await workspacesDetect(vibenClient, {
    path: "/media",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("workspacesDetect failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.WorkspacesDetectRequest](../../sdk/models/operations/workspacesdetectrequest.md)                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.WorkspacesDetectResponse](../../sdk/models/operations/workspacesdetectresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## createCreate

### Example Usage

<!-- UsageSnippet language="typescript" operationID="workspaces_createCreate" method="post" path="/api/workspaces/create" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.workspaces.createCreate();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { workspacesCreateCreate } from "@viben/client-sdk/funcs/workspacesCreateCreate.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await workspacesCreateCreate(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("workspacesCreateCreate failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## delete

### Example Usage

<!-- UsageSnippet language="typescript" operationID="workspaces_delete" method="delete" path="/api/workspaces/{id}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.workspaces.delete({
    id: "<id>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { workspacesDelete } from "@viben/client-sdk/funcs/workspacesDelete.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await workspacesDelete(vibenClient, {
    id: "<id>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("workspacesDelete failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.WorkspacesDeleteRequest](../../sdk/models/operations/workspacesdeleterequest.md)                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |