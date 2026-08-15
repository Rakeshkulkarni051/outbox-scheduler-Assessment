import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";

export async function getSenders(_req: Request, res: Response) {
  const senders = await prisma.sender.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });
  res.json(senders);
}
