// packages/core/src/gateway/routes/accounts.ts

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  listAccounts,
  addAccount,
  viewAccount,
  updateAccount,
  removeAccount,
  testAccount,
  listExchanges,
} from "../../account";
import type { ExchangeId } from "../../account";

interface CreateAccountBody {
  exchange: ExchangeId;
  name: string;
  api_key: string;
  secret: string;
  passphrase?: string;
}

interface UpdateAccountBody {
  name?: string;
  api_key?: string;
  secret?: string;
  passphrase?: string;
}

export function registerAccountsRoutes(fastify: FastifyInstance): void {
  // GET /api/exchanges — exchange registry (static meta)
  fastify.get("/api/exchanges", async () => {
    const exchanges = listExchanges();
    return {
      exchanges: exchanges.map((ex) => ({
        id: ex.id,
        name: ex.name,
        fields: ex.fields,
        referral_url: ex.referral_url,
        api_doc_url: ex.api_doc_url,
        whitelist_ip: ex.whitelist_ip,
      })),
    };
  });

  // GET /api/accounts — list all (no credentials)
  fastify.get("/api/accounts", async () => {
    const result = await listAccounts();
    return result;
  });

  // POST /api/accounts — create
  fastify.post("/api/accounts", async (
    req: FastifyRequest<{ Body: CreateAccountBody }>,
    reply,
  ) => {
    const { exchange, name, api_key, secret, passphrase } = req.body;
    if (!exchange || !name || !api_key || !secret) {
      reply.code(400);
      return { success: false, error: "exchange, name, api_key, and secret are required" };
    }
    const result = await addAccount({ exchange, name, api_key, secret, passphrase });
    if (!result.success) {
      reply.code(400);
      return result;
    }
    reply.code(201);
    return result;
  });

  // GET /api/accounts/:id — view (masked credentials)
  fastify.get("/api/accounts/:id", async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply,
  ) => {
    const result = await viewAccount(req.params.id);
    if (!result.success) {
      reply.code(404);
      return result;
    }
    return result;
  });

  // PUT /api/accounts/:id — update credentials
  fastify.put("/api/accounts/:id", async (
    req: FastifyRequest<{ Params: { id: string }; Body: UpdateAccountBody }>,
    reply,
  ) => {
    const result = await updateAccount(req.params.id, req.body);
    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return result;
    }
    return result;
  });

  // DELETE /api/accounts/:id
  fastify.delete("/api/accounts/:id", async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply,
  ) => {
    const result = await removeAccount(req.params.id);
    if (!result.success) {
      reply.code(404);
      return result;
    }
    return result;
  });

  // POST /api/accounts/:id/test — connectivity test
  fastify.post("/api/accounts/:id/test", async (
    req: FastifyRequest<{ Params: { id: string } }>,
  ) => {
    const result = await testAccount(req.params.id);
    return result;
  });
}
