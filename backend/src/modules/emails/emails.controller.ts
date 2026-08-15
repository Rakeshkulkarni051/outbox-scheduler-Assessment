import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";

export async function getScheduledEmails(_req: Request, res: Response) {
  const emails = await prisma.email.findMany({
    where: { status: { in: ["pending", "queued"] } },
    include: { campaign: true },
    orderBy: { scheduledTime: "asc" },
  });
  res.json(emails);
}

export async function getSentEmails(_req: Request, res: Response) {
  const emails = await prisma.email.findMany({
    where: { status: { in: ["sent", "failed"] } },
    include: { campaign: true },
    orderBy: { sentTime: "desc" },
  });
  res.json(emails);
}
