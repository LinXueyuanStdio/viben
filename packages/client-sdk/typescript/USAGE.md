<!-- Start SDK Example Usage [usage] -->
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.agent.list();

  console.log(result);
}

run();

```
<!-- End SDK Example Usage [usage] -->