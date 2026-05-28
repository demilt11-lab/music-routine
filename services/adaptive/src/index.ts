import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { loadEnv } from "./env.js";
import { requireAuth, type AuthContext } from "./auth.js";
import { listConfiguredProviders } from "./providers/index.js";
import { isLlmEnabled } from "./llm.js";
import { adaptiveRoutes } from "./routes/adaptive.js";
import { playlistRoutes } from "./routes/playlists.js";
import { biometricRoutes } from "./routes/biometrics.js";
import { providerRoutes } from "./routes/providers.js";

const env = loadEnv();
const app = new Hono<AuthContext>();

app.use("*", requestId());
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.ALLOWED_ORIGINS === "*" ? "*" : env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 86400,
  }),
);

// Liveness/readiness — unauthenticated, used by load balancers and uptime checks.
app.get("/health", (c) =>
  c.json({
    status: "ok",
    llm: isLlmEnabled(),
    providers: listConfiguredProviders(),
    version: "1.0.0",
  }),
);

// Everything under /v1 requires a valid Supabase JWT.
const v1 = new Hono<AuthContext>();
v1.use("*", requireAuth);
v1.route("/adaptive", adaptiveRoutes);
v1.route("/playlists", playlistRoutes);
v1.route("/biometrics", biometricRoutes);
v1.route("/providers", providerRoutes);
app.route("/v1", v1);

// Centralised error handling → consistent JSON envelope.
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: { message: err.message, status: err.status } }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json({ error: { message: "Validation failed", issues: err.issues } }, 400);
  }
  console.error(`[${c.get("requestId")}]`, err);
  return c.json({ error: { message: "Internal server error", status: 500 } }, 500);
});

app.notFound((c) => c.json({ error: { message: "Not found", status: 404 } }, 404));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`adaptive service listening on :${info.port} (env=${env.NODE_ENV})`);
});

export { app };
