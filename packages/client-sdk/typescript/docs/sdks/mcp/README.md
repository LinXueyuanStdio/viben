# Mcp

## Overview

MCP server management

### Available Operations

* [list](#list) - List installed MCP packages
* [show](#show) - Get MCP package details
* [install](#install) - Install an MCP package (supports name, name@version, gh:user/repo, ./path)
* [uninstall](#uninstall) - Uninstall an MCP package
* [search](#search) - Search MCP packages in marketplace
* [getInfo](#getinfo) - Get MCP package details from marketplace
* [download](#download) - Download MCP package to a directory
* [listInstalled](#listinstalled) - List globally installed MCP servers
* [getAgentServers](#getagentservers)
* [createAgentServer](#createagentserver)
* [getAgentServer](#getagentserver)
* [deleteAgentServer](#deleteagentserver)
* [updateAgentServer](#updateagentserver)
* [enableAgentServer](#enableagentserver)
* [disableAgentServer](#disableagentserver)
* [createPortStatu](#createportstatu)
* [killProcess](#killprocess)
* [createProcessAlive](#createprocessalive)
* [getInspectorHealth](#getinspectorhealth)
* [getInspectorConfig](#getinspectorconfig)
* [getInspectorToken](#getinspectortoken)
* [listInspectorSessions](#listinspectorsessions)
* [deleteInspectorSession](#deleteinspectorsession)
* [listInspectorMcp](#listinspectormcp)
* [createInspectorMcp](#createinspectormcp)
* [deleteInspectorMcp](#deleteinspectormcp)
* [listInspectorStdio](#listinspectorstdio)
* [listInspectorSse](#listinspectorsse)
* [createInspectorSse](#createinspectorsse)
* [createInspectorMessage](#createinspectormessage)

## list

List installed MCP packages

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_list" method="get" path="/api/mcp/list" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.mcp.list();

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpList } from "@viben/client-sdk/funcs/mcpList.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpList(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("mcpList failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpListRequest](../../sdk/models/operations/mcplistrequest.md)                                                                                                     | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.McpListResponse](../../sdk/models/operations/mcplistresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## show

Get MCP package details

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_show" method="get" path="/api/mcp/show/{name}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.mcp.show({
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
import { mcpShow } from "@viben/client-sdk/funcs/mcpShow.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpShow(vibenClient, {
    name: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("mcpShow failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpShowRequest](../../sdk/models/operations/mcpshowrequest.md)                                                                                                     | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.McpShowResponse](../../sdk/models/operations/mcpshowresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## install

Install an MCP package (supports name, name@version, gh:user/repo, ./path)

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_install" method="post" path="/api/mcp/install" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.mcp.install({
    spec: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpInstall } from "@viben/client-sdk/funcs/mcpInstall.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpInstall(vibenClient, {
    spec: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("mcpInstall failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpInstallRequestBody](../../sdk/models/operations/mcpinstallrequestbody.md)                                                                                       | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.McpInstallResponse](../../sdk/models/operations/mcpinstallresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## uninstall

Uninstall an MCP package

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_uninstall" method="post" path="/api/mcp/uninstall" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.mcp.uninstall({
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
import { mcpUninstall } from "@viben/client-sdk/funcs/mcpUninstall.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpUninstall(vibenClient, {
    name: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("mcpUninstall failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpUninstallRequestBody](../../sdk/models/operations/mcpuninstallrequestbody.md)                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.McpUninstallResponse](../../sdk/models/operations/mcpuninstallresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## search

Search MCP packages in marketplace

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_search" method="get" path="/api/mcp/search" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.mcp.search({
    query: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpSearch } from "@viben/client-sdk/funcs/mcpSearch.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpSearch(vibenClient, {
    query: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("mcpSearch failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpSearchRequest](../../sdk/models/operations/mcpsearchrequest.md)                                                                                                 | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.McpSearchResponse](../../sdk/models/operations/mcpsearchresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## getInfo

Get MCP package details from marketplace

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_getInfo" method="get" path="/api/mcp/info/{idOrSlug}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.mcp.getInfo({
    idOrSlug: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpGetInfo } from "@viben/client-sdk/funcs/mcpGetInfo.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpGetInfo(vibenClient, {
    idOrSlug: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("mcpGetInfo failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpGetInfoRequest](../../sdk/models/operations/mcpgetinforequest.md)                                                                                               | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.McpGetInfoResponse](../../sdk/models/operations/mcpgetinforesponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## download

Download MCP package to a directory

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_download" method="post" path="/api/mcp/download" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.mcp.download({
    name: "<value>",
    targetDir: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpDownload } from "@viben/client-sdk/funcs/mcpDownload.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpDownload(vibenClient, {
    name: "<value>",
    targetDir: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("mcpDownload failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpDownloadRequestBody](../../sdk/models/operations/mcpdownloadrequestbody.md)                                                                                     | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.McpDownloadResponse](../../sdk/models/operations/mcpdownloadresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## listInstalled

List globally installed MCP servers

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_listInstalled" method="get" path="/api/mcp/installed" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.mcp.listInstalled();

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpListInstalled } from "@viben/client-sdk/funcs/mcpListInstalled.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpListInstalled(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("mcpListInstalled failed:", res.error);
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

**Promise\<[operations.McpListInstalledResponseBody](../../sdk/models/operations/mcplistinstalledresponsebody.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## getAgentServers

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_getAgentServers" method="get" path="/api/mcp/agents/{agentId}/servers" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.getAgentServers({
    agentId: "<id>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpGetAgentServers } from "@viben/client-sdk/funcs/mcpGetAgentServers.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpGetAgentServers(vibenClient, {
    agentId: "<id>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpGetAgentServers failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpGetAgentServersRequest](../../sdk/models/operations/mcpgetagentserversrequest.md)                                                                               | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## createAgentServer

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_createAgentServer" method="post" path="/api/mcp/agents/{agentId}/servers" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.createAgentServer({
    agentId: "<id>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpCreateAgentServer } from "@viben/client-sdk/funcs/mcpCreateAgentServer.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpCreateAgentServer(vibenClient, {
    agentId: "<id>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpCreateAgentServer failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpCreateAgentServerRequest](../../sdk/models/operations/mcpcreateagentserverrequest.md)                                                                           | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## getAgentServer

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_getAgentServer" method="get" path="/api/mcp/agents/{agentId}/servers/{name}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.getAgentServer({
    agentId: "<id>",
    name: "<value>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpGetAgentServer } from "@viben/client-sdk/funcs/mcpGetAgentServer.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpGetAgentServer(vibenClient, {
    agentId: "<id>",
    name: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpGetAgentServer failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpGetAgentServerRequest](../../sdk/models/operations/mcpgetagentserverrequest.md)                                                                                 | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## deleteAgentServer

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_deleteAgentServer" method="delete" path="/api/mcp/agents/{agentId}/servers/{name}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.deleteAgentServer({
    agentId: "<id>",
    name: "<value>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpDeleteAgentServer } from "@viben/client-sdk/funcs/mcpDeleteAgentServer.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpDeleteAgentServer(vibenClient, {
    agentId: "<id>",
    name: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpDeleteAgentServer failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpDeleteAgentServerRequest](../../sdk/models/operations/mcpdeleteagentserverrequest.md)                                                                           | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## updateAgentServer

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_updateAgentServer" method="patch" path="/api/mcp/agents/{agentId}/servers/{name}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.updateAgentServer({
    agentId: "<id>",
    name: "<value>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpUpdateAgentServer } from "@viben/client-sdk/funcs/mcpUpdateAgentServer.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpUpdateAgentServer(vibenClient, {
    agentId: "<id>",
    name: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpUpdateAgentServer failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpUpdateAgentServerRequest](../../sdk/models/operations/mcpupdateagentserverrequest.md)                                                                           | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## enableAgentServer

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_enableAgentServer" method="post" path="/api/mcp/agents/{agentId}/servers/{name}/enable" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.enableAgentServer({
    agentId: "<id>",
    name: "<value>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpEnableAgentServer } from "@viben/client-sdk/funcs/mcpEnableAgentServer.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpEnableAgentServer(vibenClient, {
    agentId: "<id>",
    name: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpEnableAgentServer failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpEnableAgentServerRequest](../../sdk/models/operations/mcpenableagentserverrequest.md)                                                                           | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## disableAgentServer

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_disableAgentServer" method="post" path="/api/mcp/agents/{agentId}/servers/{name}/disable" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.disableAgentServer({
    agentId: "<id>",
    name: "<value>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpDisableAgentServer } from "@viben/client-sdk/funcs/mcpDisableAgentServer.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpDisableAgentServer(vibenClient, {
    agentId: "<id>",
    name: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpDisableAgentServer failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpDisableAgentServerRequest](../../sdk/models/operations/mcpdisableagentserverrequest.md)                                                                         | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## createPortStatu

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_createPortStatu" method="post" path="/api/mcp/port/status" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.createPortStatu();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpCreatePortStatu } from "@viben/client-sdk/funcs/mcpCreatePortStatu.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpCreatePortStatu(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpCreatePortStatu failed:", res.error);
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

## killProcess

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_killProcess" method="post" path="/api/mcp/process/kill" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.killProcess();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpKillProcess } from "@viben/client-sdk/funcs/mcpKillProcess.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpKillProcess(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpKillProcess failed:", res.error);
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

## createProcessAlive

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_createProcessAlive" method="post" path="/api/mcp/process/alive" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.createProcessAlive();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpCreateProcessAlive } from "@viben/client-sdk/funcs/mcpCreateProcessAlive.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpCreateProcessAlive(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpCreateProcessAlive failed:", res.error);
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

## getInspectorHealth

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_getInspectorHealth" method="get" path="/api/mcp/inspector/health" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.getInspectorHealth();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpGetInspectorHealth } from "@viben/client-sdk/funcs/mcpGetInspectorHealth.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpGetInspectorHealth(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpGetInspectorHealth failed:", res.error);
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

## getInspectorConfig

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_getInspectorConfig" method="get" path="/api/mcp/inspector/config" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.getInspectorConfig();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpGetInspectorConfig } from "@viben/client-sdk/funcs/mcpGetInspectorConfig.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpGetInspectorConfig(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpGetInspectorConfig failed:", res.error);
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

## getInspectorToken

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_getInspectorToken" method="get" path="/api/mcp/inspector/token" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.getInspectorToken();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpGetInspectorToken } from "@viben/client-sdk/funcs/mcpGetInspectorToken.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpGetInspectorToken(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpGetInspectorToken failed:", res.error);
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

## listInspectorSessions

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_listInspectorSessions" method="get" path="/api/mcp/inspector/sessions" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.listInspectorSessions();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpListInspectorSessions } from "@viben/client-sdk/funcs/mcpListInspectorSessions.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpListInspectorSessions(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpListInspectorSessions failed:", res.error);
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

## deleteInspectorSession

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_deleteInspectorSession" method="delete" path="/api/mcp/inspector/sessions/{sessionId}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.deleteInspectorSession({
    sessionId: "<id>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpDeleteInspectorSession } from "@viben/client-sdk/funcs/mcpDeleteInspectorSession.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpDeleteInspectorSession(vibenClient, {
    sessionId: "<id>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpDeleteInspectorSession failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.McpDeleteInspectorSessionRequest](../../sdk/models/operations/mcpdeleteinspectorsessionrequest.md)                                                                 | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## listInspectorMcp

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_listInspectorMcp" method="get" path="/api/mcp/inspector/mcp" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.listInspectorMcp();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpListInspectorMcp } from "@viben/client-sdk/funcs/mcpListInspectorMcp.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpListInspectorMcp(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpListInspectorMcp failed:", res.error);
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

## createInspectorMcp

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_createInspectorMcp" method="post" path="/api/mcp/inspector/mcp" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.createInspectorMcp();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpCreateInspectorMcp } from "@viben/client-sdk/funcs/mcpCreateInspectorMcp.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpCreateInspectorMcp(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpCreateInspectorMcp failed:", res.error);
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

## deleteInspectorMcp

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_deleteInspectorMcp" method="delete" path="/api/mcp/inspector/mcp" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.deleteInspectorMcp();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpDeleteInspectorMcp } from "@viben/client-sdk/funcs/mcpDeleteInspectorMcp.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpDeleteInspectorMcp(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpDeleteInspectorMcp failed:", res.error);
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

## listInspectorStdio

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_listInspectorStdio" method="get" path="/api/mcp/inspector/stdio" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.listInspectorStdio();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpListInspectorStdio } from "@viben/client-sdk/funcs/mcpListInspectorStdio.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpListInspectorStdio(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpListInspectorStdio failed:", res.error);
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

## listInspectorSse

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_listInspectorSse" method="get" path="/api/mcp/inspector/sse" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.listInspectorSse();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpListInspectorSse } from "@viben/client-sdk/funcs/mcpListInspectorSse.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpListInspectorSse(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpListInspectorSse failed:", res.error);
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

## createInspectorSse

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_createInspectorSse" method="post" path="/api/mcp/inspector/sse" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.createInspectorSse();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpCreateInspectorSse } from "@viben/client-sdk/funcs/mcpCreateInspectorSse.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpCreateInspectorSse(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpCreateInspectorSse failed:", res.error);
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

## createInspectorMessage

### Example Usage

<!-- UsageSnippet language="typescript" operationID="mcp_createInspectorMessage" method="post" path="/api/mcp/inspector/message" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.mcp.createInspectorMessage();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { mcpCreateInspectorMessage } from "@viben/client-sdk/funcs/mcpCreateInspectorMessage.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await mcpCreateInspectorMessage(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("mcpCreateInspectorMessage failed:", res.error);
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