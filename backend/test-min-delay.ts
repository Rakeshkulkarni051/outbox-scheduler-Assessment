import { prisma } from "./src/db/prisma";
import { getSenderQueue, jobIdForEmail } from "./src/queue/queues";

/**
 * Bypasses the HTTP API (and its auth) entirely — creates a campaign with
 * a short delayMs and several recipients for an existing sender, then
 * enqueues them the exact same way schedule.service.ts does. Lets you
 * verify min-delay enforcement purely from the terminal, worker included.
 */
async function main() {
  const sender = await prisma.sender.findFirst();
  if (!sender) {
    throw new Error("No sender found — run `npx tsx seed.ts` first.");
  }

  const DELAY_MS = 5000; // 5s between sends, easy to eyeball in the worker log
  const now = new Date();

  const campaign = await prisma.campaign.create({
    data: {
      subject: "Min Delay Test",
      body: "<p>Testing min delay enforcement</p>",
      startTime: now,
      delayMs: DELAY_MS,
      hourlyLimit: 200,
      emails: {
        create: [
          { recipient: "delay-test-1@example.com", senderId: sender.id, scheduledTime: now },
          { recipient: "delay-test-2@example.com", senderId: sender.id, scheduledTime: now },
          { recipient: "delay-test-3@example.com", senderId: sender.id, scheduledTime: now },
        ],
      },
    },
    include: { emails: true },
  });

  const queue = getSenderQueue(sender.id);
  for (const email of campaign.emails) {
    await queue.add(
      "send-email",
      { emailId: email.id, subject: campaign.subject, body: campaign.body },
      { jobId: jobIdForEmail(email.id), delay: 0 }
    );
  }

  console.log(`Enqueued ${campaign.emails.length} emails for sender ${sender.id}, delayMs=${DELAY_MS}`);
  console.log("Now start the worker (npm run worker) and watch the 'email sent' timestamps.");
}

main().finally(() => prisma.$disconnect());