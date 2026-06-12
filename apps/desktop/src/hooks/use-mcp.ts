import { useCallback } from "react";
import {
  getGatewayClient,
  type PortStatus,
} from "@/lib/gateway";

export type { PortStatus };

export function useMcp() {
  const checkPortStatus = useCallback(async (port: number): Promise<PortStatus> => {
    try {
      const client = getGatewayClient();
      return await client.checkPortStatus(port);
    } catch {
      return { in_use: false, pid: null, process_name: null };
    }
  }, []);

  const killProcess = useCallback(async (pid: number): Promise<boolean> => {
    try {
      const client = getGatewayClient();
      return await client.killProcess(pid);
    } catch {
      return false;
    }
  }, []);

  const isProcessAlive = useCallback(async (pid: number): Promise<boolean> => {
    try {
      const client = getGatewayClient();
      return await client.isProcessAlive(pid);
    } catch {
      return false;
    }
  }, []);

  return {
    checkPortStatus,
    killProcess,
    isProcessAlive,
  };
}
