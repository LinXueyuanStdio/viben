import type {
  AcpPermissionMode,
  AcpRequestPermissionRequest,
  AcpRequestPermissionResponse,
} from "../types";

export type PermissionDecision =
  | {
      auto: true;
      response: AcpRequestPermissionResponse;
    }
  | {
      auto: false;
    };

export interface PermissionHandler {
  evaluate(params: AcpRequestPermissionRequest, permissionMode: AcpPermissionMode): Promise<PermissionDecision>;
}

export class DefaultPermissionHandler implements PermissionHandler {
  async evaluate(
    params: AcpRequestPermissionRequest,
    permissionMode: AcpPermissionMode
  ): Promise<PermissionDecision> {
    if (permissionMode === "bypassPermissions") {
      return {
        auto: true,
        response: buildSelectedPermissionResponse(params),
      };
    }
    return { auto: false };
  }
}

export function createDefaultPermissionHandler(): PermissionHandler {
  return new DefaultPermissionHandler();
}

export function buildSelectedPermissionResponse(params: AcpRequestPermissionRequest): AcpRequestPermissionResponse {
  return {
    outcome: {
      outcome: "selected",
      optionId: params.options[0]?.optionId ?? "yes",
    },
  };
}
