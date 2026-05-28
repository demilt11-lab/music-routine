import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { jwtVerify } from "jose";
import { loadEnv } from "./env.js";

export interface AuthContext {
  Variables: {
    userId: string;
    requestId: string;
  };
}

/**
 * Verify the Supabase-issued JWT locally (HS256, signed with the project JWT
 * secret). Local verification avoids a network round-trip to Supabase Auth on
 * every request, which matters at scale. The verified subject (`sub`) is the
 * user id every downstream query is scoped to.
 */
export const requireAuth = createMiddleware<AuthContext>(async (c, next) => {
  const header = c.req.header("authorization");
  const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
  if (!token) {
    throw new HTTPException(401, { message: "Missing bearer token" });
  }

  const env = loadEnv();
  try {
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.sub) throw new Error("token has no subject");
    c.set("userId", payload.sub);
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  await next();
});
