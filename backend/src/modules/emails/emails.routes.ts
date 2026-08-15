import { Router } from "express";
import { getScheduledEmails, getSentEmails } from "./emails.controller";
import { requireGoogleAuth } from "../auth/auth.middleware";

export const emailsRouter = Router();
emailsRouter.get("/emails/scheduled", requireGoogleAuth, getScheduledEmails);
emailsRouter.get("/emails/sent", requireGoogleAuth, getSentEmails);
