import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";

export interface InputHistoryResponse {
  entries: string[];
  total: number;
  limit: number;
}

export async function getInputHistory(
  baseUrl: string,
  options: { limit?: number } = {}
): Promise<InputHistoryResponse> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  const query = params.toString();
  const response = await fetch(`${baseUrl}/api/input-history${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get input history: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
