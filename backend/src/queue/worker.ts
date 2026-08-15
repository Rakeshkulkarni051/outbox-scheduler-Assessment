import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import { queueNameFor } from "./queues";
import { sendViaEthereal } from "../smtp/ethereal";

/**
 * One Worker per sender (mirrors the per-sender Queue in queues.ts), each
 * with its own limiter sourced from that sender's most recent campaign.
 * BullMQ's limiter is Redis-backed, so this stays correct even if you run
 * multiple worker processes later.
 */
function startWorkerForSender(senderId: string, hourlyLimit: number) {
  const worker = new Worker(
    queueNameFor(senderId),
    async (job) => {
      const { emailId } = job.data as { emailId: string };

      // Second idempotency guard: even if a job somehow got processed twice
      // (shouldn't happen given the deterministic jobId), skip anything
      // that's already terminal.
      const email = await prisma.email.findUnique({ where: { id: emailId } });
      if (!email || email.status === "sent" || email.status === "failed") {
        logger.info("skipping already-terminal email", { emailId });
        return;
      }

      try {
        const { previewUrl } = await sendViaEthereal({
          to: email.recipient,
          subject: job.data.subject ?? "",
          html: job.data.body ?? "",
        });

        await prisma.email.update({
          where: { id: emailId },
          data: { status: "sent", sentTime: new Date() },
        });

        logger.info("email sent", { emailId, previewUrl });
      } catch (err) {
        await prisma.email.update({ where: { id: emailId }, data: { status: "failed" } });
        throw err; // let BullMQ record it as a failed job too
      }
    },
    {
      connection: redisConnection,
      concurrency: env.workerConcurrency,
      limiter: { max: hourlyLimit, duration: 60 * 60 * 1000 },
    }
  );

  worker.on("completed", (job) => logger.info("job completed", { jobId: job.id }));
  worker.on("failed", (job, err) => logger.error("job failed", { jobId: job?.id, err: err.message }));

  return worker;
}

async function main() {
  const senders = await prisma.sender.findMany();

  for (const sender of senders) {
    // Use the hourlyLimit from that sender's latest campaign, fall back to a
    // sane default if they have none yet.
    const latestCampaign = await prisma.campaign.findFirst({
      where: { emails: { some: { senderId: sender.id } } },
      orderBy: { createdAt: "desc" },
    });
    startWorkerForSender(sender.id, latestCampaign?.hourlyLimit ?? 200);
  }

  logger.info(
    `worker process up, watching ${senders.length} sender queue(s), concurrency=${env.workerConcurrency}`
  );
}

main().catch((err) => {
  logger.error("worker failed to start", { err: err.message });
  process.exit(1);
});
