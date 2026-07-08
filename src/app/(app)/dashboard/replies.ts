// Pure reply-text composition + send guard for approval responses. Kept
// separate from actions.ts (which needs a DB/auth/request context) so this
// can be unit-checked in isolation. No side effects.

export function orderApprovedText(eta: string): string {
  const minutes = eta === "45" || eta === "60" ? eta : "30";
  return `Your order was approved. Estimated time: ${minutes} minutes.`;
}
export const orderRejectedText = "Sorry, your order could not be approved right now.";

export function repairApprovedText(mode: string): string {
  return mode === "appointment"
    ? "Your repair request was approved. A staff member will contact you to schedule a time."
    : "Your repair request was approved. You can bring the device today during business hours.";
}
export const repairRejectedText = "Sorry, we cannot approve this repair request right now.";

// Only WhatsApp-sourced items with a known customer id get a reply; simulator
// items (channel "simulator") and pre-migration rows (channel null) are
// skipped, never failed.
export function shouldSendReply(channel: string | null, to: string | null): boolean {
  return channel === "whatsapp" && !!to;
}
