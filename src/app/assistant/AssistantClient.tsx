"use client";

import { useRef, useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Card } from "@/components/app/Pill";

type Role = "user" | "model";

interface UiMessage {
  role: Role;
  content: string;
  tools?: { name: string; summary: string }[];
}

const SUGGESTIONS = [
  "What should I do today?",
  "Show me my top 5 holdings and their G/L.",
  "I want to change my risk tolerance to aggressive.",
  "Why is my core allocation below target?",
];

export function AssistantClient() {
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      role: "model",
      content:
        "Hi. I can read your portfolio, preferences, and sync log. If you want, I can also update your preferences directly — I'll always confirm before I change anything.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setErr(null);
    const nextMessages: UiMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(nextMessages);
    setSending(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "assistant failed");
      setMessages((prev) => [
        ...prev,
        { role: "model", content: body.text || "(no response)", tools: body.tools },
      ]);
      setTimeout(() => {
        scrollerRef.current?.scrollTo({
          top: scrollerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 50);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center justify-between px-8 py-5 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight flex items-center gap-2">
              <Sparkles size={18} style={{ color: "var(--accent)" }} />
              Assistant
            </h1>
            <p className="text-[12px] text-[color:var(--text-muted)] mt-1">
              Gemini · reads your portfolio, preferences, and sync log.
            </p>
          </div>
          <button
            className="btn btn-sm"
            onClick={() =>
              setMessages([
                {
                  role: "model",
                  content:
                    "New chat. Ask me anything about your portfolio or preferences.",
                },
              ])
            }
          >
            New chat
          </button>
        </header>

        <div
          ref={scrollerRef}
          className="flex-1 overflow-auto px-8 py-6 space-y-4"
        >
          {messages.map((m, i) => (
            <Message key={i} m={m} />
          ))}
          {sending && (
            <div className="text-[12px] text-[color:var(--text-muted)] flex items-center gap-2">
              <Sparkles size={12} className="animate-pulse" />
              Thinking…
            </div>
          )}
          {err && (
            <div
              className="text-[12px] px-3 py-2 rounded"
              style={{
                background: "var(--loss-soft)",
                color: "var(--loss)",
                border:
                  "1px solid color-mix(in oklab, var(--loss) 40%, transparent)",
              }}
            >
              {err}
            </div>
          )}
        </div>

        {/* Composer */}
        <div
          className="px-8 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="chip"
                style={{ cursor: "pointer" }}
                onClick={() => send(s)}
                disabled={sending}
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2"
          >
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your money…"
              disabled={sending}
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!input.trim() || sending}
            >
              <Send size={14} />
              Send
            </button>
          </form>
          <p className="mt-2 text-[11px] italic text-[color:var(--text-faint)]">
            Informational only — not financial, tax, or legal advice.
          </p>
        </div>
      </div>

      {/* Context rail */}
      <aside
        className="w-[300px] shrink-0 p-5 flex flex-col gap-3 overflow-auto"
        style={{
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">
          What I can see
        </div>
        <Card>
          <div className="text-[11px] text-[color:var(--text-muted)] uppercase tracking-wider">
            Tools
          </div>
          <ul
            className="mt-2 text-[11.5px] mono space-y-1"
            style={{ color: "var(--text-muted)" }}
          >
            <li>getPortfolioSummary()</li>
            <li>getHoldings(symbol?)</li>
            <li>getSyncStatus(limit?)</li>
            <li>getProfile()</li>
            <li>getPreferences()</li>
            <li style={{ color: "var(--accent-strong)" }}>
              updatePreferences(…)
            </li>
            <li style={{ color: "var(--accent-strong)" }}>
              updateProfile(…)
            </li>
          </ul>
        </Card>
        <Card>
          <div className="text-[11px] text-[color:var(--text-muted)] uppercase tracking-wider">
            Transparent
          </div>
          <p className="mt-1 text-[12px] leading-relaxed">
            Every tool call is logged in-line in each response. Mutating tools
            require your confirmation before running.
          </p>
        </Card>
      </aside>
    </div>
  );
}

function Message({ m }: { m: UiMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="px-3 py-2 rounded-[8px] max-w-[80%] text-[13px] leading-relaxed"
          style={{
            background: "var(--accent-soft)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {m.content}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[80%]">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent-strong)",
            border: "1px solid var(--border)",
          }}
        >
          <Sparkles size={11} />
        </div>
        <span className="text-[11px] text-[color:var(--text-muted)]">
          Assistant
        </span>
      </div>
      {m.tools && m.tools.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {m.tools.map((t, i) => (
            <span key={i} className="chip chip-info" style={{ fontSize: 10 }}>
              ⚙ {t.name} · {t.summary}
            </span>
          ))}
        </div>
      )}
      <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
        {m.content}
      </div>
    </div>
  );
}
