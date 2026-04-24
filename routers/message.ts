import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { messages, fans } from "@db/schema";
import { eq, desc, count, and } from "drizzle-orm";

const ENCRYPTION_KEY = "jim-newman-fan-portal-secret-key-2025";

function encrypt(text: string): string {
  const key = ENCRYPTION_KEY;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function decrypt(encrypted: string): string {
  const key = ENCRYPTION_KEY;
  const text = atob(encrypted);
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

export const messageRouter = createRouter({
  send: publicQuery
    .input(
      z.object({
        fanId: z.string(),
        sender: z.enum(["fan", "admin"]),
        content: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const fanResult = await db
        .select({ id: fans.id })
        .from(fans)
        .where(eq(fans.fanId, input.fanId))
        .limit(1);
      if (!fanResult[0]) {
        throw new Error("Fan not found");
      }

      const encryptedContent = encrypt(input.content);

      await db.insert(messages).values({
        fanId: fanResult[0].id,
        sender: input.sender,
        content: encryptedContent,
        encrypted: true,
        read: input.sender === "admin",
      });

      return {
        success: true,
        messageId: 0,
      };
    }),

  getByFan: publicQuery
    .input(
      z.object({
        fanId: z.string(),
        limit: z.number().default(100),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const fanResult = await db
        .select({ id: fans.id })
        .from(fans)
        .where(eq(fans.fanId, input.fanId))
        .limit(1);
      if (!fanResult[0]) return [];

      const results = await db
        .select()
        .from(messages)
        .where(eq(messages.fanId, fanResult[0].id))
        .orderBy(desc(messages.createdAt))
        .limit(input.limit);

      return results.map((msg) => ({
        ...msg,
        content: msg.encrypted ? decrypt(msg.content) : msg.content,
      }));
    }),

  getAllFans: publicQuery.query(async () => {
    const db = getDb();
    const allFans = await db
      .select({
        id: fans.id,
        fanId: fans.fanId,
        fullName: fans.fullName,
        instagramUsername: fans.instagramUsername,
      })
      .from(fans)
      .orderBy(desc(fans.createdAt));

    const result = [];
    for (const fan of allFans) {
      const lastMsg = await db
        .select()
        .from(messages)
        .where(eq(messages.fanId, fan.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      const unreadCount = await db
        .select({ count: count() })
        .from(messages)
        .where(and(eq(messages.fanId, fan.id), eq(messages.sender, "fan"), eq(messages.read, false)));

      result.push({
        fanId: fan.fanId,
        fanName: fan.fullName,
        instagramUsername: fan.instagramUsername,
        lastMessage: lastMsg[0]
          ? lastMsg[0].encrypted
            ? decrypt(lastMsg[0].content)
            : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt || null,
        unreadCount: unreadCount[0]?.count || 0,
      });
    }

    return result;
  }),

  markRead: publicQuery
    .input(
      z.object({
        fanId: z.string(),
        sender: z.enum(["fan", "admin"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const fanResult = await db
        .select({ id: fans.id })
        .from(fans)
        .where(eq(fans.fanId, input.fanId))
        .limit(1);
      if (!fanResult[0]) return { success: false };

      await db
        .update(messages)
        .set({ read: true })
        .where(
          and(
            eq(messages.fanId, fanResult[0].id),
            eq(messages.sender, input.sender),
            eq(messages.read, false)
          )
        );

      return { success: true };
    }),
});
