import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

/**
 * One BullMQ queue PER SENDER.
 *
 * Why: BullMQ's worker-level `limiter` (max jobs per duration) is Redis-backed,
 * so it's safe across multiple worker processes/instances out of the box.
 * OSS BullMQ doesn't support per-group limits inside a single queue, so the
 * clean way to get an hourly cap "per sender" is a queue per sender, each
 * with its own limiter. This also gives us the "delay between sends" for
 * free (duration / max sets the spacing) without hand-rolled Redis counters.
 *
 * Queues are cheap (just a name + the shared connection), so we lazily
 * create + cache them rather than pre-declaring one per known sender.
 */
const queueCache = new Map<string, Queue>();

export function queueNameFor(senderId: string): string {
  return `emails-sender-${senderId}`;
}

export function getSenderQueue(senderId: string): Queue {
  const name = queueNameFor(senderId);
  const cached = queueCache.get(name);
  if (cached) return cached;

  const queue = new Queue(name, { connection: redisConnection });
  queueCache.set(name, queue);
  return queue;
}

export function jobIdForEmail(emailId: string): string {
  // Deterministic id = idempotency. Calling queue.add() twice with the same
  // jobId is a no-op in BullMQ, so re-running the enqueue step (e.g. during
  // startup reconciliation) can never double-schedule an email.
  return `email-${emailId}`;
}
