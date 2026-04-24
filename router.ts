import { createRouter, publicQuery } from "./middleware";
import { fanRouter } from "./routers/fan";
import { paymentRouter } from "./routers/payment";
import { messageRouter } from "./routers/message";
import { adminRouter } from "./routers/admin";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  fan: fanRouter,
  payment: paymentRouter,
  message: messageRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
