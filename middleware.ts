import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

// Admin procedure - checks for admin token in Authorization header
export const adminQuery = t.procedure.use(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.replace("Bearer ", "");
  // Token validation happens in the router
  return next({ ctx: { ...ctx, adminToken: token } });
});
