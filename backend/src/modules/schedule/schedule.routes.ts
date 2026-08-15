import { Router } from "express";
import { postSchedule } from "./schedule.controller";

export const scheduleRouter = Router();
scheduleRouter.post("/schedule", postSchedule);
