import { ApiError, api } from "./api";

/**
 * Creating an API key or inviting a user on a business that has its own
 * owner needs a super admin and an emailed code (the backend answers
 * BUSINESS_SELF_MANAGED otherwise). This sends the call; on that answer it
 * asks the backend to email the code, prompts for it and sends the call
 * again with it. Anyone but a super admin is refused the code, and sees the
 * original explanation.
 */
export async function withBusinessAccessCode<T>(
  businessId: string,
  send: (proof?: { challengeId: string; code: string }) => Promise<T>,
): Promise<T> {
  try {
    return await send();
  } catch (e) {
    if (!(e instanceof ApiError && e.code === "BUSINESS_SELF_MANAGED")) throw e;
    let challenge: { challengeId: string; sentTo: string };
    try {
      challenge = await api.post(`/admin/businesses/${businessId}/access/code`);
    } catch {
      throw e; // not a super admin: the first answer explains why
    }
    const code = window
      .prompt(
        `This business has its own owner and manages its own access. Its owners will be told about this change.\n\nWe emailed a 6-digit code to ${challenge.sentTo}. Enter it to continue:`,
      )
      ?.replace(/\D/g, "");
    if (!code) throw e;
    return send({ challengeId: challenge.challengeId, code });
  }
}
