# Queue

## Overview

### Available Operations

* [enqueue](#enqueue)
* [getStatus](#getstatus)
* [listTasks](#listtasks)
* [getTaskRunning](#gettaskrunning)
* [getTask](#gettask)
* [deleteTask](#deletetask)
* [getTaskStream](#gettaskstream)
* [retryTask](#retrytask)
* [getConfig](#getconfig)
* [updateConfig](#updateconfig)
* [createEnqueueBatch](#createenqueuebatch)
* [createClearHistory](#createclearhistory)

## enqueue

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_enqueue" method="post" path="/api/queue/enqueue" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.enqueue();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueEnqueue } from "@viben/client-sdk/funcs/queueEnqueue.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueEnqueue(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueEnqueue failed:", res.error);
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

## getStatus

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_getStatus" method="get" path="/api/queue/status" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.getStatus();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueGetStatus } from "@viben/client-sdk/funcs/queueGetStatus.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueGetStatus(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueGetStatus failed:", res.error);
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

## listTasks

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_listTasks" method="get" path="/api/queue/tasks" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.listTasks();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueListTasks } from "@viben/client-sdk/funcs/queueListTasks.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueListTasks(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueListTasks failed:", res.error);
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

## getTaskRunning

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_getTaskRunning" method="get" path="/api/queue/tasks/{id}/running" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.getTaskRunning({
    id: "<id>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueGetTaskRunning } from "@viben/client-sdk/funcs/queueGetTaskRunning.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueGetTaskRunning(vibenClient, {
    id: "<id>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueGetTaskRunning failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.QueueGetTaskRunningRequest](../../sdk/models/operations/queuegettaskrunningrequest.md)                                                                             | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## getTask

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_getTask" method="get" path="/api/queue/tasks/{id}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.getTask({
    id: "<id>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueGetTask } from "@viben/client-sdk/funcs/queueGetTask.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueGetTask(vibenClient, {
    id: "<id>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueGetTask failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.QueueGetTaskRequest](../../sdk/models/operations/queuegettaskrequest.md)                                                                                           | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## deleteTask

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_deleteTask" method="delete" path="/api/queue/tasks/{id}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.deleteTask({
    id: "<id>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueDeleteTask } from "@viben/client-sdk/funcs/queueDeleteTask.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueDeleteTask(vibenClient, {
    id: "<id>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueDeleteTask failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.QueueDeleteTaskRequest](../../sdk/models/operations/queuedeletetaskrequest.md)                                                                                     | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## getTaskStream

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_getTaskStream" method="get" path="/api/queue/tasks/{id}/stream" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.getTaskStream({
    id: "<id>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueGetTaskStream } from "@viben/client-sdk/funcs/queueGetTaskStream.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueGetTaskStream(vibenClient, {
    id: "<id>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueGetTaskStream failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.QueueGetTaskStreamRequest](../../sdk/models/operations/queuegettaskstreamrequest.md)                                                                               | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## retryTask

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_retryTask" method="post" path="/api/queue/tasks/{id}/retry" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.retryTask({
    id: "<id>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueRetryTask } from "@viben/client-sdk/funcs/queueRetryTask.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueRetryTask(vibenClient, {
    id: "<id>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueRetryTask failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.QueueRetryTaskRequest](../../sdk/models/operations/queueretrytaskrequest.md)                                                                                       | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## getConfig

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_getConfig" method="get" path="/api/queue/config" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.getConfig();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueGetConfig } from "@viben/client-sdk/funcs/queueGetConfig.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueGetConfig(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueGetConfig failed:", res.error);
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

## updateConfig

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_updateConfig" method="put" path="/api/queue/config" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.updateConfig();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueUpdateConfig } from "@viben/client-sdk/funcs/queueUpdateConfig.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueUpdateConfig(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueUpdateConfig failed:", res.error);
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

## createEnqueueBatch

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_createEnqueueBatch" method="post" path="/api/queue/enqueue-batch" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.createEnqueueBatch();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueCreateEnqueueBatch } from "@viben/client-sdk/funcs/queueCreateEnqueueBatch.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueCreateEnqueueBatch(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueCreateEnqueueBatch failed:", res.error);
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

## createClearHistory

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queue_createClearHistory" method="post" path="/api/queue/clear-history" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.queue.createClearHistory();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { queueCreateClearHistory } from "@viben/client-sdk/funcs/queueCreateClearHistory.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await queueCreateClearHistory(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("queueCreateClearHistory failed:", res.error);
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