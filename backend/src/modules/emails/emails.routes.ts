import { Router } from "express";
import { getScheduledEmails, getSentEmails } from "./emails.controller";

export const emailsRouter = Router();
emailsRouter.get("/emails/scheduled", getScheduledEmails);
emailsRouter.get("/emails/sent", getSentEmails);
