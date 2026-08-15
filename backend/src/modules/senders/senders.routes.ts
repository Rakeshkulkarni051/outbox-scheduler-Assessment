import { Router } from "express";
import { getSenders } from "./senders.controller";
import { requireGoogleAuth } from "../auth/auth.middleware";

export const sendersRouter = Router();
sendersRouter.get("/senders", requireGoogleAuth, getSenders);
