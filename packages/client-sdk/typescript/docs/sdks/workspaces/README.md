# Workspaces

## Overview

Workspace management

### Available Operations

* [getApiWorkspaces](#getapiworkspaces) - List all workspaces including the global workspace
* [getApiWorkspacesDetect](#getapiworkspacesdetect) - Detect folder status (.git and .viben directories)

## getApiWorkspaces

List all workspaces including the global workspace

### Example Usage

<!-- UsageSnippet language="typescript" operationID="get_/api/workspaces" method="get" path="/api/workspaces" -->
```typescript
import { SDK } from "@viben/client-sdk";

const sdk = new SDK();

async function run() {
  const result = await sdk.workspaces.getApiWorkspaces();

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { SDKCore } from "@viben/client-sdk/core.js";
import { workspacesGetApiWorkspaces } from "@viben/client-sdk/funcs/workspacesGetApiWorkspaces.js";

// Use `SDKCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const sdk = new SDKCore();

async function run() {
  const res = await workspacesGetApiWorkspaces(sdk);
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("workspacesGetApiWorkspaces failed:", res.error);
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

**Promise\<[operations.GetApiWorkspacesResponseBody](../../sdk/models/operations/getapiworkspacesresponsebody.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## getApiWorkspacesDetect

Detect folder status (.git and .viben directories)

### Example Usage

<!-- UsageSnippet language="typescript" operationID="get_/api/workspaces/detect" method="get" path="/api/workspaces/detect" -->
```typescript
import { SDK } from "@viben/client-sdk";

const sdk = new SDK();

async function run() {
  const result = await sdk.workspaces.getApiWorkspacesDetect({
    path: "/home/user/dir",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { SDKCore } from "@viben/client-sdk/core.js";
import { workspacesGetApiWorkspacesDetect } from "@viben/client-sdk/funcs/workspacesGetApiWorkspacesDetect.js";

// Use `SDKCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const sdk = new SDKCore();

async function run() {
  const res = await workspacesGetApiWorkspacesDetect(sdk, {
    path: "/home/user/dir",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("workspacesGetApiWorkspacesDetect failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.GetApiWorkspacesDetectRequest](../../sdk/models/operations/getapiworkspacesdetectrequest.md)                                                                       | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.GetApiWorkspacesDetectResponse](../../sdk/models/operations/getapiworkspacesdetectresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |