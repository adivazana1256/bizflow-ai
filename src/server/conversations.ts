import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { businesses, conversations, messages } from "../db/schema";
import type { ChatMessage } from "../flow/types";
import { DEV_BUSINESS_ID } from "../lib/constants";

// Conversation Manager. Owns the conversation/message tables so channel
// transports (WhatsApp today) don't touch Drizzle directly. Single-tenant
// deployment: one businesses row; getDeploymentBusinessId() resolves it.

let cachedBusinessId: string | null = null;

export async function getDeploymentBusinessId(): Promise<string> {
  if (cachedBusinessId) return cachedBusinessId;
  // Deterministic, not an unordered `limit(1)` — must match the id the seed
  // pins and the dev-login bypass returns, or WhatsApp writes and the panel
  // read land on different business rows.
  const [biz] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.id, DEV_BUSINESS_ID))
    .limit(1);
  if (!biz) throw new Error("no business row — run npm run db:seed");
  cachedBusinessId = biz.id;
  return biz.id;
}

export async function getOrCreateConversation(businessId: string, channel: string, externalId: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.businessId, businessId),
        eq(conversations.channel, channel),
        eq(conversations.externalId, externalId),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(conversations)
    .values({ businessId, channel, externalId })
    .onConflictDoNothing({ target: [conversations.businessId, conversations.channel, conversations.externalId] })
    .returning();
  if (created) return created;

  // Lost a race with a concurrent webhook delivery — read what the winner inserted.
  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.businessId, businessId),
        eq(conversations.channel, channel),
        eq(conversations.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Append a message. When `channelMessageId` is set (WhatsApp wamid) a repeat
 * (Meta's retried webhook) is skipped — this is the idempotency mechanism.
 */
export async function appendMessage(
  conversationId: string,
  businessId: string,
  role: "user" | "assistant",
  text: string,
  channelMessageId?: string,
): Promise<{ inserted: boolean }> {
  const [row] = await db
    .insert(messages)
    .values({ conversationId, businessId, role, text, channelMessageId: channelMessageId ?? null })
    .onConflictDoNothing({ target: [messages.businessId, messages.channelMessageId] })
    .returning({ id: messages.id });
  return { inserted: !!row };
}

export async function getHistory(conversationId: string): Promise<ChatMessage[]> {
  const rows = await db
    .select({ role: messages.role, text: messages.text })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
  return rows.map((r) => ({ role: r.role as ChatMessage["role"], content: r.text }));
}