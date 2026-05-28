import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { biometricIngestRequestSchema } from "@biomusic/core/contracts";
import { type AuthContext } from "../auth.js";
import { rateLimit } from "../rate-limit.js";
import { ingestBiometrics } from "../repository.js";

/**
 * POST /v1/biometrics/ingest
 * High-throughput batched ingestion of biometric samples for a session. The
 * client buffers samples locally and flushes a batch every few seconds to keep
 * request volume bounded as the user base grows.
 */
export const biometricRoutes = new Hono<AuthContext>();

biometricRoutes.post("/ingest", rateLimit({ name: "biometrics", limit: 60, windowSeconds: 60 }), async (c) => {
  const body = biometricIngestRequestSchema.parse(await c.req.json());
  const userId = c.get("userId");
  try {
    const inserted = await ingestBiometrics(userId, body);
    return c.json({ inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest failed";
    if (message === "session not found") throw new HTTPException(404, { message });
    throw new HTTPException(500, { message });
  }
});
