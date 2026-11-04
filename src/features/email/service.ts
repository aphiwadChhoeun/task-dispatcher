import "server-only";
import { log, reportError } from "@/lib/observability";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailService {
  readonly name: string;
  send(message: EmailMessage): Promise<boolean>;
}

/** Default local/no-op sender. Swap for Resend, Postmark, or MailChannels. */
class LogEmailService implements EmailService {
  readonly name = "log";
  async send(message: EmailMessage): Promise<boolean> {
    log("info", "email queued (no provider configured)", {
      to: message.to,
      subject: message.subject,
    });
    return true;
  }
}

let service: EmailService = new LogEmailService();

export function setEmailService(next: EmailService): void {
  service = next;
}

export function getEmailService(): EmailService {
  return service;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    await service.send(message);
  } catch (error) {
    reportError(error, { scope: "email", to: message.to });
  }
}
