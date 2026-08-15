import type { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

// The frontend signs users in with NextAuth's Google provider (see
// frontend/app/api/auth/[...nextauth]/route.ts) and exposes the raw Google
// id_token on the session as `session.idToken`. The frontend API client
// sends that as `Authorization: Bearer <id_token>` on every request.
//
// We verify it here rather than trusting a decoded-but-unchecked JWT:
// OAuth2Client.verifyIdToken checks the signature against Google's public
// keys and validates `aud` against our own client ID, so a caller can't
// forge a token or replay one issued for a different app.
const client = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

export interface AuthenticatedUser {
  email: string;
  name?: string;
  picture?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireGoogleAuth(req: Request, res: Response, next: NextFunction) {
  if (!client) {
    // Fail closed: an unconfigured GOOGLE_CLIENT_ID means we cannot verify
    // anything, so refuse rather than silently letting requests through.
    logger.error("requireGoogleAuth: GOOGLE_CLIENT_ID is not set on the backend");
    return res.status(500).json({ error: "Server auth is not configured" });
  }

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: env.googleClientId });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = { email: payload.email, name: payload.name, picture: payload.picture };
    next();
  } catch (err) {
    logger.error("requireGoogleAuth: token verification failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
