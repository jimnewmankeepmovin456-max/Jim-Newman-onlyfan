import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { adminSessions } from "@db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const ADMIN_PASSWORD = "Danielv5$";

export const adminRouter = createRouter({
  login: publicQuery
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      if (input.password !== ADMIN_PASSWORD) {
        return { success: false, message: "Incorrect password" };
      }

      const db = getDb();
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.insert(adminSessions).values({
        token,
        expiresAt,
      });

      return { success: true, token };
    }),

  verify: publicQuery
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.token, input.token))
        .limit(1);

      if (!result[0]) {
        return { valid: false };
      }

      if (new Date(result[0].expiresAt) < new Date()) {
        return { valid: false };
      }

      return { valid: true };
    }),

  getStats: publicQuery.query(async () => {
    const db = getDb();
    const { fans, payments } = await import("@db/schema");
    const { count, sql, eq } = await import("drizzle-orm");

    const totalFansResult = await db.select({ count: count() }).from(fans);
    const pendingResult = await db.select({ count: count() }).from(fans).where(eq(fans.status, "pending"));
    const verifiedResult = await db.select({ count: count() }).from(fans).where(eq(fans.status, "verified"));
    const totalRevenueResult = await db
      .select({ total: sql`SUM(${payments.amount})` })
      .from(payments)
      .where(eq(payments.status, "completed"));

    return {
      totalFans: totalFansResult[0]?.count || 0,
      pendingVerification: pendingResult[0]?.count || 0,
      verifiedFans: verifiedResult[0]?.count || 0,
      totalRevenue: totalRevenueResult[0]?.total || 0,
    };
  }),

  logout: publicQuery
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(adminSessions).where(eq(adminSessions.token, input.token));
      return { success: true };
    }),
});
