import type { Request, Response } from "express";
import { createCampaignSchema } from "./schedule.dto";
import { createCampaign } from "./schedule.service";

export async function postSchedule(req: Request, res: Response) {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = await createCampaign(parsed.data);
  res.status(201).json(campaign);
}
