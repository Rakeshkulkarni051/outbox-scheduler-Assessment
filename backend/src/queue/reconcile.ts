import { prisma } from "../db/prisma";
import { getSenderQueue, jobIdForEmail } from "./queues";
import { logger } from "../utils/logger";

/**
 * Run once on server startup.
 *
 * Redis/BullMQ already survives a restart on its own — this covers the one
 * gap that doesn't: a crash between "row written to Postgres" and "job added
 * to the queue". Any Email row still 'pending' gets re-enqueued; the
 * deterministic jobId (see queues.ts) makes this safe to run even if some
 * of those jobs were actually already queued.
 */
export async function reconcilePendingEmails() {
  const pending = await prisma.email.findMany({ where: { status: "pending" }, include: { campaign: true } });

  for (const email of pending) {
    const queue = getSenderQueue(email.senderId);
    const delay = Math.max(0, email.scheduledTime.getTime() - Date.now());

    await queue.add(
      "send-email",
      { emailId: email.id, subject: email.campaign.subject, body: email.campaign.body },
      { jobId: jobIdForEmail(email.id), delay }
    );
  }

  logger.info(`reconciliation: re-checked ${pending.length} pending email(s)`);
}
