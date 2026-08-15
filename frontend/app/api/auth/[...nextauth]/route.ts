import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
  },
  callbacks: {
    // Surface the Google id_token on the session so the API client can
    // send it as a bearer token once the backend verifies it (see
    // backend/src/modules/auth/auth.routes.ts — currently a TODO).
    async jwt({ token, account }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.idToken) {
        session.idToken = token.idToken;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
