import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { queueNameFor } from "./queues";
// import { sendViaEthereal } from "../smtp/ethereal"; // wired up next pass

/**
 * TODO (next pass): spin up one Worker per known sender at boot (mirrors the
 * per-sender Queue in queues.ts), each with its own `limiter: { max, duration }`
 * sourced from that sender's active campaign(s). New senders created at
 * runtime should also get a Worker started for them.
 *
 * Each worker's processor should, for a given job:
 *   1. Re-check the Email row's status in Postgres (skip if already 'sent' —
 *      second idempotency guard beyond the deterministic jobId).
 *   2. Send via Ethereal SMTP.
 *   3. Update status -> 'sent' (or 'failed') + sentTime, in the same
 *      transaction/step so a crash mid-send can't leave inconsistent state.
 *
 * Stub below shows the shape for a single sender so `npm run worker` runs.
 */

function startWorkerForSender(senderId: string) {
  const worker = new Worker(
    queueNameFor(senderId),
    async (job) => {
      logger.info("processing email job", { jobId: job.id, senderId });
      // TODO: load Email row by job.data.emailId, guard on status, send, update status
    },
    {
      connection: redisConnection,
      concurrency: 5, // TODO: make configurable per sender
      limiter: { max: 200, duration: 60 * 60 * 1000 }, // TODO: source from campaign.hourlyLimit
    }
  );

  worker.on("completed", (job) => logger.info("job completed", { jobId: job.id }));
  worker.on("failed", (job, err) => logger.error("job failed", { jobId: job?.id, err: err.message }));

  return worker;
}

async function main() {
  const senders = await prisma.sender.findMany();
  senders.forEach((s) => startWorkerForSender(s.id));
  logger.info(`worker process up, watching ${senders.length} sender queue(s)`);
}

main().catch((err) => {
  logger.error("worker failed to start", { err: err.message });
  process.exit(1);
});
