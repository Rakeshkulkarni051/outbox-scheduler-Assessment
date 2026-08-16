import { Worker } from "bullmq";
import express from "express";
import { redisConnection } from "../config/redis";
import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import { queueNameFor } from "./queues";
import { sendViaEthereal } from "../smtp/ethereal";

// Render's free tier only offers "Web Service" (needs a listening port for
// health checks), not "Background Worker" (paid-only). This tiny server
// exists purely so the worker process can be deployed as a free Web
// Service — it does nothing but answer /health. Pair with an external
// uptime pinger (e.g. UptimeRobot, free) hitting this endpoint every few
// minutes so Render doesn't spin the service down from inactivity, which
// would otherwise delay on-time sends.
const healthApp = express();
healthApp.get("/health", (_req, res) => res.json({ ok: true, role: "worker" }));
healthApp.listen(env.workerPort, () => logger.info(`worker health endpoint listening on :${env.port}`));

// Redis-backed "next allowed send slot" per sender, so the minimum delay
// between sends is enforced correctly even across CONCURRENT jobs (worker
// concurrency > 1) and multiple worker processes. A naive GET-then-SET has
// a race: two jobs can both read the same "last sent" value before either
// writes back, so neither sees the other's reservation and both fire at
// once (this is exactly what happened in testing — jobs 2 and 3 sent at
// the same millisecond). Fixed with a small Lua script: Redis runs it
// atomically, so "read last slot, compute next slot, write it back" can't
// interleave with another job doing the same thing.
const RESERVE_SLOT_SCRIPT = `
local key = KEYS[1]
local minDelay = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local lastSlot = tonumber(redis.call('GET', key) or '0')
local nextSlot = math.max(now, lastSlot + minDelay)
redis.call('SET', key, nextSlot)
return nextSlot
`;

async function waitForMinDelay(senderId: string, minDelayMs: number) {
  if (minDelayMs <= 0) return;

  const key = `next-slot:${senderId}`;
  const nextSlot = Number(
    await redisConnection.eval(RESERVE_SLOT_SCRIPT, 1, key, minDelayMs, Date.now())
  );

  const waitMs = nextSlot - Date.now();
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function startWorkerForSender(senderId: string, hourlyLimit: number, minDelayMs: number) {
  const worker = new Worker(
    queueNameFor(senderId),
    async (job) => {
      const { emailId } = job.data as { emailId: string };

      const email = await prisma.email.findUnique({ where: { id: emailId } });
      if (!email || email.status === "sent" || email.status === "failed") {
        logger.info("skipping already-terminal email", { emailId });
        return;
      }

      // Enforce the minimum gap between sends for this sender (mimics
      // provider throttling), independent of the hourly cap above.
      await waitForMinDelay(senderId, minDelayMs);

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
        throw err;
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
    const latestCampaign = await prisma.campaign.findFirst({
      where: { emails: { some: { senderId: sender.id } } },
      orderBy: { createdAt: "desc" },
    });
    startWorkerForSender(
      sender.id,
      latestCampaign?.hourlyLimit ?? env.defaultHourlyLimit,
      latestCampaign?.delayMs ?? env.minDelayMs
    );
  }

  logger.info(
    `worker process up, watching ${senders.length} sender queue(s), concurrency=${env.workerConcurrency}`
  );
}

main().catch((err) => {
  logger.error("worker failed to start", { err: err.message });
  process.exit(1);
});