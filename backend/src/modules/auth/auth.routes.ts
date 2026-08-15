import { Router } from "express";

// TODO (frontend uses NextAuth for the Google OAuth flow itself). This route
// is a placeholder for verifying the session/id-token on API calls once the
// frontend is wired up — e.g. checking a bearer token with google-auth-library
// or validating the NextAuth JWT, and attaching req.user.
export const authRouter = Router();
