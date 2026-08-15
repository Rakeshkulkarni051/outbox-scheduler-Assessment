import nodemailer from "nodemailer";
import { env } from "../config/env";

// Ethereal is fake SMTP for dev/testing — nothing actually gets delivered,
// but we get a preview URL back per message. Generate creds at
// https://ethereal.email/create and drop them in .env.
export const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: { user: env.ethereal.user, pass: env.ethereal.pass },
});

export async function sendViaEthereal(opts: { to: string; subject: string; html: string }) {
  const info = await transporter.sendMail({
    from: '"Outbox Scheduler" <scheduler@outbox.test>',
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
}
