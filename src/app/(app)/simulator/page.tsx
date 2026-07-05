"use client";

import { useRef, useState } from "react";

type Result = { status: string; action: string; payload?: unknown };
type Msg = { role: "user" | "assistant"; content: string; result?: Result };

export default function SimulatorPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mock, setMock] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send full history (stateless backend), stripping the result field.
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMock(Boolean(data.mock));
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: data.reply ?? "…", result: data.result },
      ]);
    } catch {
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: "⚠️ Failed to reach the chat backend." },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chat Simulator</h1>
        {mock !== null && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            {mock ? "mock AI" : "live AI"}
          </span>
        )}
      </div>

      <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-gray-300">
        <div className="bg-emerald-700 px-4 py-2 text-sm font-medium text-white">Tony&apos;s Pizza</div>

        <div className="flex-1 space-y-2 overflow-y-auto bg-[#e5ddd5] p-3">
          {messages.length === 0 && (
            <p className="mt-8 text-center text-sm text-gray-500">
              Say &quot;hi&quot;, ask about delivery, or order a pizza.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow " +
                  (m.role === "user" ? "bg-[#dcf8c6]" : "bg-white")
                }
              >
                {m.content}
                {m.result && (
                  <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-2 text-xs text-emerald-200">
                    {JSON.stringify(m.result, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex gap-2 border-t border-gray-200 bg-white p-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message"
            className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
