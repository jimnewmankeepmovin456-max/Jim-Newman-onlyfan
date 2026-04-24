import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { payments } from "@db/schema";
import { eq, desc, count } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";

function generateTransactionId(): string {
  return `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function saveBase64File(base64Data: string, folder: string, filename: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "uploads", folder);
  await fs.mkdir(uploadsDir, { recursive: true });
  const base64Content = base64Data.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64Content, "base64");
  const filepath = path.join(uploadsDir, filename);
  await fs.writeFile(filepath, buffer);
  return `/uploads/${folder}/${filename}`;
}

export const paymentRouter = createRouter({
  create: publicQuery
    .input(
      z.object({
        fanId: z.string(),
        amount: z.number().positive(),
        method: z.enum(["apple_gift_card", "cash_app", "steam_card", "apple_pay"]),
        receipt: z.string().optional(),
        cashAppTag: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const transactionId = generateTransactionId();
      let receiptUrl: string | undefined;

      if (input.receipt) {
        const filename = `${transactionId}_receipt_${Date.now()}.png`;
        receiptUrl = await saveBase64File(input.receipt, "receipts", filename);
      }

      // Get fan internal id
      const { fans } = await import("@db/schema");
      const fanResult = await db.select({ id: fans.id }).from(fans).where(eq(fans.fanId, input.fanId)).limit(1);
      if (!fanResult[0]) {
        throw new Error("Fan not found");
      }

      await db.insert(payments).values({
        fanId: fanResult[0].id,
        transactionId,
        amount: input.amount.toFixed(2),
        method: input.method,
        receiptUrl,
        cashAppTag: input.cashAppTag,
        status: "pending",
      });

      return {
        success: true,
        transactionId,
        message: "Payment submitted successfully! Awaiting admin verification.",
      };
    }),

  getByFan: publicQuery
    .input(z.object({ fanId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const { fans } = await import("@db/schema");
      const fanResult = await db.select({ id: fans.id }).from(fans).where(eq(fans.fanId, input.fanId)).limit(1);
      if (!fanResult[0]) return [];

      const result = await db
        .select()
        .from(payments)
        .where(eq(payments.fanId, fanResult[0].id))
        .orderBy(desc(payments.createdAt));
      return result;
    }),

  getAll: publicQuery
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      const totalResult = await db.select({ count: count() }).from(payments);
      const total = totalResult[0]?.count || 0;

      const results = await db
        .select()
        .from(payments)
        .orderBy(desc(payments.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { payments: results, total };
    }),

  updateStatus: publicQuery
    .input(
      z.object({
        transactionId: z.string(),
        status: z.enum(["pending", "completed", "failed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(payments)
        .set({ status: input.status })
        .where(eq(payments.transactionId, input.transactionId));

      // If payment completed, update fan to verified
      if (input.status === "completed") {
        const paymentResult = await db
          .select({ fanId: payments.fanId })
          .from(payments)
          .where(eq(payments.transactionId, input.transactionId))
          .limit(1);
        if (paymentResult[0]) {
          const { fans } = await import("@db/schema");
          await db
            .update(fans)
            .set({ status: "verified", cardActivated: true })
            .where(eq(fans.id, paymentResult[0].fanId));
        }
      }

      return { success: true };
    }),

  getRevenue: publicQuery.query(async () => {
    const db = getDb();
    const result = await db
      .select({ total: count() })
      .from(payments)
      .where(eq(payments.status, "completed"));
    return { totalCompleted: result[0]?.total || 0 };
  }),
});
