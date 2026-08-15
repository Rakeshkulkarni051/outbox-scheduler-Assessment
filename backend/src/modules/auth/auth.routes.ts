import { Router } from "express";

// The actual verification middleware now lives in ./auth.middleware.ts
// (requireGoogleAuth) and is applied directly on the protected routers
// (schedule.routes.ts, emails.routes.ts, senders.routes.ts). This file is
// kept as a place to add any future auth-only endpoints (e.g. a
// "/auth/me" health-check for the currently authenticated user) — there
// are none yet, so this router is currently unused.
export const authRouter = Router();
