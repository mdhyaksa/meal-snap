"use client";

import { useEffect, useRef, useState } from "react";
import type { NutritionFacts } from "@/lib/domain/nutrition";

type Message = { role: "user" | "assistant" | "error"; content: string };

const STARTERS = ["Is this a balanced meal?", "How do I cut the sodium?", "What should I eat next?"];

/** OpenRouter streams OpenAI-shaped SSE: `data: {...}` lines, `: comment` keep-alives, `data: [DONE]`. */
async function* streamDeltas(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    let cut = buffer.indexOf("\n");
    while (cut !== -1) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      cut = buffer.indexOf("\n");

      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;

      try {
        const chunk = JSON.parse(payload) as {
          choices?: { delta?: { content?: string | null } }[];
          error?: { message?: string };
        };
        if (chunk.error?.message) throw new Error(chunk.error.message);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch (e) {
        if (e instanceof SyntaxError) continue; // partial JSON, wait for more
        throw e;
      }
    }
  }
}

export default function Chat({
  imageDataUrl,
  facts,
}: {
  imageDataUrl: string;
  facts: NutritionFacts;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const stream = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stream.current?.scrollTo({ top: stream.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const turns = [
      ...messages.filter((m) => m.role !== "error").map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: question },
    ];

    setMessages((prev) => [...prev, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl, facts, turns }),
      });

      if (!res.ok || !res.body) {
        const { error } = (await res.json().catch(() => ({ error: "The model didn't answer. Try again." }))) as {
          error?: string;
        };
        throw new Error(error ?? "The model didn't answer. Try again.");
      }

      for await (const delta of streamDeltas(res.body)) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + delta };
          return next;
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((prev) => {
        const next = [...prev];
        // drop the empty assistant placeholder, show the failure in its place
        if (next[next.length - 1]?.role === "assistant" && !next[next.length - 1].content) next.pop();
        return [...next, { role: "error", content: message }];
      });
    } finally {
      setBusy(false);
    }
  }

  const streaming = busy && messages[messages.length - 1]?.role === "assistant";

  return (
    <section className="chat">
      <div className="card">
        <div className="chat-head">
          <b>Ask about this meal</b>
          <span>photo + label are in context</span>
        </div>

        <div className="stream" ref={stream} aria-live="polite">
          {messages.length === 0 && (
            <div className="msg a">
              I&apos;ve read your photo and the label above. Ask me anything — portions, swaps, how it fits your
              day.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "u" : m.role === "error" ? "err" : "a"}`}>
              {m.content}
              {streaming && i === messages.length - 1 && <span className="cursor" />}
            </div>
          ))}
        </div>

        {messages.length === 0 && (
          <div className="chips">
            {STARTERS.map((s) => (
              <button type="button" key={s} className="chip" onClick={() => send(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder="Ask anything about this meal…"
            rows={1}
            maxLength={4000}
          />
          <button type="submit" className="btn" disabled={busy || !draft.trim()}>
            {busy ? "…" : "Send"}
          </button>
        </form>
      </div>
    </section>
  );
}
