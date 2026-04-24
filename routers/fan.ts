import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { fans } from "@db/schema";
import { eq, desc, count } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";

function generateFanId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `JM-${part1}-${part2}`;
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

export const fanRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        fullName: z.string().min(2).max(100),
        instagramUsername: z.string().min(1).max(50),
        email: z.string().email(),
        phone: z.string().min(5).max(20),
        dateOfBirth: z.string(),
        address: z.string().min(5),
        idDocument: z.string().optional(),
        faceCapture: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const fanId = generateFanId();
      let idDocumentUrl: string | undefined;
      let faceCaptureUrl: string | undefined;

      if (input.idDocument) {
        const filename = `${fanId}_id_${Date.now()}.png`;
        idDocumentUrl = await saveBase64File(input.idDocument, "documents", filename);
        // Also save to dorothy folder for admin access
        const dorothyDir = path.join(process.cwd(), "uploads", "dorothy");
        await fs.mkdir(dorothyDir, { recursive: true });
        const base64Content = input.idDocument.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Content, "base64");
        await fs.writeFile(path.join(dorothyDir, filename), buffer);
      }

      if (input.faceCapture) {
        const filename = `${fanId}_face_${Date.now()}.png`;
        faceCaptureUrl = await saveBase64File(input.faceCapture, "face-captures", filename);
      }

      await db.insert(fans).values({
        fanId,
        fullName: input.fullName,
        instagramUsername: input.instagramUsername,
        email: input.email,
        phone: input.phone,
        dateOfBirth: new Date(input.dateOfBirth),
        address: input.address,
        idDocumentUrl,
        faceCaptureUrl,
        status: "pending",
        cardGenerated: true,
        cardActivated: false,
      });

      return {
        success: true,
        fanId,
        message: "Registration successful! Your Bronze Fan Card has been generated.",
      };
    }),

  getById: publicQuery
    .input(z.object({ fanId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db.select().from(fans).where(eq(fans.fanId, input.fanId)).limit(1);
      return result[0] || null;
    }),

  getAll: publicQuery
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(50),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;
      const conditions = [];
      if (input.status) {
        conditions.push(eq(fans.status, input.status as "pending" | "verified" | "rejected"));
      }
      
      const totalResult = await db.select({ count: count() }).from(fans);
      const total = totalResult[0]?.count || 0;

      const results = await db
        .select()
        .from(fans)
        .orderBy(desc(fans.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { fans: results, total };
    }),

  updateStatus: publicQuery
    .input(
      z.object({
        fanId: z.string(),
        status: z.enum(["pending", "verified", "rejected"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(fans)
        .set({
          status: input.status,
          cardActivated: input.status === "verified",
          updatedAt: new Date(),
        })
        .where(eq(fans.fanId, input.fanId));
      return { success: true };
    }),

  getStats: publicQuery.query(async () => {
    const db = getDb();
    const totalResult = await db.select({ count: count() }).from(fans);
    const pendingResult = await db.select({ count: count() }).from(fans).where(eq(fans.status, "pending"));
    const verifiedResult = await db.select({ count: count() }).from(fans).where(eq(fans.status, "verified"));

    return {
      totalFans: totalResult[0]?.count || 0,
      pendingVerification: pendingResult[0]?.count || 0,
      verifiedFans: verifiedResult[0]?.count || 0,
    };
  }),
});
