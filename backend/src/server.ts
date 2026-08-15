import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { scheduleRouter } from "./modules/schedule/schedule.routes";
import { emailsRouter } from "./modules/emails/emails.routes";
import { reconcilePendingEmails } from "./queue/reconcile";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", scheduleRouter);
app.use("/api", emailsRouter);

async function main() {
  await reconcilePendingEmails();
  app.listen(env.port, () => logger.info(`backend listening on :${env.port}`));
}

main().catch((err) => {
  logger.error("server failed to start", { err: err.message });
  process.exit(1);
});
