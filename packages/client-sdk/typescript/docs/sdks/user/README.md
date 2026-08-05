# User

## Overview

### Available Operations

* [listMe](#listme)
* [updateMe](#updateme)
* [listMeFavorites](#listmefavorites)
* [listMeApiKeys](#listmeapikeys)
* [createMeApiKey](#createmeapikey)
* [deleteMeApiKey](#deletemeapikey)
* [get](#get)

## listMe

### Example Usage

<!-- UsageSnippet language="typescript" operationID="user_listMe" method="get" path="/api/user/me" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.user.listMe();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { userListMe } from "@viben/client-sdk/funcs/userListMe.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await userListMe(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("userListMe failed:", res.error);
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

## updateMe

### Example Usage

<!-- UsageSnippet language="typescript" operationID="user_updateMe" method="patch" path="/api/user/me" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.user.updateMe();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { userUpdateMe } from "@viben/client-sdk/funcs/userUpdateMe.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await userUpdateMe(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("userUpdateMe failed:", res.error);
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

## listMeFavorites

### Example Usage

<!-- UsageSnippet language="typescript" operationID="user_listMeFavorites" method="get" path="/api/user/me/favorites" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.user.listMeFavorites();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { userListMeFavorites } from "@viben/client-sdk/funcs/userListMeFavorites.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await userListMeFavorites(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("userListMeFavorites failed:", res.error);
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

## listMeApiKeys

### Example Usage

<!-- UsageSnippet language="typescript" operationID="user_listMeApiKeys" method="get" path="/api/user/me/api-keys" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.user.listMeApiKeys();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { userListMeApiKeys } from "@viben/client-sdk/funcs/userListMeApiKeys.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await userListMeApiKeys(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("userListMeApiKeys failed:", res.error);
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

## createMeApiKey

### Example Usage

<!-- UsageSnippet language="typescript" operationID="user_createMeApiKey" method="post" path="/api/user/me/api-keys" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.user.createMeApiKey();


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { userCreateMeApiKey } from "@viben/client-sdk/funcs/userCreateMeApiKey.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await userCreateMeApiKey(vibenClient);
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("userCreateMeApiKey failed:", res.error);
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

## deleteMeApiKey

### Example Usage

<!-- UsageSnippet language="typescript" operationID="user_deleteMeApiKey" method="delete" path="/api/user/me/api-keys/{id}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.user.deleteMeApiKey({
    id: "<id>",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { userDeleteMeApiKey } from "@viben/client-sdk/funcs/userDeleteMeApiKey.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await userDeleteMeApiKey(vibenClient, {
    id: "<id>",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("userDeleteMeApiKey failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.UserDeleteMeApiKeyRequest](../../sdk/models/operations/userdeletemeapikeyrequest.md)                                                                               | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |

## get

### Example Usage

<!-- UsageSnippet language="typescript" operationID="user_get" method="get" path="/api/user/{username}" -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  await vibenClient.user.get({
    username: "Maureen2",
  });


}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { VibenClientCore } from "@viben/client-sdk/core.js";
import { userGet } from "@viben/client-sdk/funcs/userGet.js";

// Use `VibenClientCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const vibenClient = new VibenClientCore();

async function run() {
  const res = await userGet(vibenClient, {
    username: "Maureen2",
  });
  if (res.ok) {
    const { value: result } = res;
    
  } else {
    console.log("userGet failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.UserGetRequest](../../sdk/models/operations/usergetrequest.md)                                                                                                     | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<void\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.SDKError | 4XX, 5XX        | \*/\*           |