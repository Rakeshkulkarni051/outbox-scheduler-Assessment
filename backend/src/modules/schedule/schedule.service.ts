import { prisma } from "../../db/prisma";
import { getSenderQueue, jobIdForEmail } from "../../queue/queues";
import type { CreateCampaignInput } from "./schedule.dto";

export async function createCampaign(input: CreateCampaignInput) {
  // Write campaign + one Email row per recipient first (source of truth),
  // THEN enqueue — this ordering is what reconcile.ts depends on: if the
  // process dies after the DB write but before the enqueue loop finishes,
  // reconciliation on next boot will pick up whatever wasn't queued yet.
  const campaign = await prisma.campaign.create({
    data: {
      subject: input.subject,
      body: input.body,
      startTime: input.startTime,
      delayMs: input.delayMs,
      hourlyLimit: input.hourlyLimit,
      emails: {
        create: input.recipients.map((recipient) => ({
          recipient,
          senderId: input.senderId,
          scheduledTime: input.startTime,
        })),
      },
    },
    include: { emails: true },
  });

  const queue = getSenderQueue(input.senderId);
  for (const email of campaign.emails) {
    const delay = Math.max(0, email.scheduledTime.getTime() - Date.now());
    await queue.add("send-email", { emailId: email.id }, { jobId: jobIdForEmail(email.id), delay });
  }

  return campaign;
}
