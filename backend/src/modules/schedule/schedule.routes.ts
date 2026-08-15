import { Router } from "express";
import { postSchedule } from "./schedule.controller";
import { requireGoogleAuth } from "../auth/auth.middleware";

export const scheduleRouter = Router();
scheduleRouter.post("/schedule", requireGoogleAuth, postSchedule);
