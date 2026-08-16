import "dotenv/config";

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  workerPort: Number(process.env.WORKER_PORT ?? process.env.PORT ?? 4001),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  ethereal: {
    user: process.env.ETHEREAL_USER ?? "",
    pass: process.env.ETHEREAL_PASS ?? "",
  },
  defaultHourlyLimit: Number(process.env.DEFAULT_HOURLY_LIMIT ?? 200),
  minDelayMs: Number(process.env.MIN_DELAY_MS ?? 2000),
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
};
