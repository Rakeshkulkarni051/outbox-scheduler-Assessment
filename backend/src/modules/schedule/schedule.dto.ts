import { z } from "zod";

export const createCampaignSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  startTime: z.coerce.date(),
  delayMs: z.number().int().positive().default(2000),
  hourlyLimit: z.number().int().positive().default(200),
  senderId: z.string().uuid(),
  recipients: z.array(z.string().email()).min(1),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
