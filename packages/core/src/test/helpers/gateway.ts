/**
 * Gateway test helpers for route testing
 */
import Fastify, { type FastifyInstance } from "fastify";

export interface GatewayTestContext {
  app: FastifyInstance;
  inject: FastifyInstance["inject"];
  close: () => Promise<void>;
}

/**
 * Create a Fastify app for testing routes
 */
export async function createGatewayTestApp(): Promise<GatewayTestContext> {
  const app = Fastify({
    logger: false,
  });

  return {
    app,
    inject: app.inject.bind(app),
    close: async () => {
      await app.close();
    },
  };
}

/**
 * Assert successful JSON response
 */
export function assertJsonResponse(
  response: { statusCode: number; body: string },
  expectedStatus = 200
): unknown {
  if (response.statusCode !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.statusCode}: ${response.body}`
    );
  }
  return JSON.parse(response.body);
}

/**
 * Assert error response
 */
export function assertErrorResponse(
  response: { statusCode: number; body: string },
  expectedStatus: number,
  errorPattern?: string | RegExp
): unknown {
  if (response.statusCode !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.statusCode}: ${response.body}`
    );
  }

  const body = JSON.parse(response.body);

  if (errorPattern) {
    const errorMsg = body.error || body.message || "";
    const matches =
      typeof errorPattern === "string"
        ? errorMsg.includes(errorPattern)
        : errorPattern.test(errorMsg);

    if (!matches) {
      throw new Error(
        `Expected error to match ${errorPattern}, got: ${errorMsg}`
      );
    }
  }

  return body;
}
