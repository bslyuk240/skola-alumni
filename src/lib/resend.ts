import type { ReactNode } from "react";
import { Resend } from "resend";
import { getResendEnv } from "@/config/env";

let cachedClient: Resend | null = null;

function getResendClient(): Resend {
  if (!cachedClient) {
    cachedClient = new Resend(getResendEnv().RESEND_API_KEY);
  }
  return cachedClient;
}

interface SendTransactionalEmailArgs {
  to: string;
  subject: string;
  react: ReactNode;
}

const DEFAULT_FROM = "Skola Alumni <notifications@skolaalumni.app>";

export async function sendTransactionalEmail({ to, subject, react }: SendTransactionalEmailArgs) {
  return getResendClient().emails.send({
    from: DEFAULT_FROM,
    to,
    subject,
    react,
  });
}
