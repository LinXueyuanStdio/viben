import { createVibenPage, VibenPageSDK } from "./viben-page-sdk";

const vibenPage = createVibenPage();

(window as unknown as { VibenPage?: VibenPageSDK }).VibenPage = vibenPage;

export { createVibenPage, vibenPage as VibenPage, VibenPageSDK };
export type {
  ActionDef,
  ActionDefinition,
  ActionResult,
  ConnectionState,
  ExecuteContext,
  PageIdentity,
  Theme,
  VibenConfig,
} from "./viben-page-sdk";
