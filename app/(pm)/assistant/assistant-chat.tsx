"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, CircleHelp, Database, MessageCircle, RotateCcw } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import type { AssistantChunk } from "@/infrastructure/query-assistant/client";
import { AssistantCapabilities } from "./assistant-capabilities";

type ChatSource = { label: string; value: string };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[];
};

function formatSourceValue(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

type SourceRow = Record<string, unknown>;

function isRowArray(value: unknown): value is SourceRow[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))
  );
}

// A tool result is either directly an array of records, or a wrapper object
// with one property that is (e.g. YouTrack search_issues' `{issuesPage:
// [...], hasNextPage}`) -- checked generically, not by name, so this works
// for any tool's list-shaped result, not just search_issues.
function findRowArray(value: unknown): SourceRow[] | null {
  if (isRowArray(value)) {
    return value;
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const nested of Object.values(value)) {
      if (isRowArray(nested)) {
        return nested;
      }
    }
  }
  return null;
}

// The raw MCP tool result is `Array<{type, text}>`, with the actual payload
// JSON-encoded inside each block's `text` string -- unwrap that before
// looking for a row array.
function extractSourceRows(value: string): SourceRow[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  // Unwrapped payloads first -- the raw MCP envelope itself
  // (`[{type:"text",text:"..."}]`) is also technically an array of
  // records, but the actual tool data nested inside `text` is what should
  // win whenever it's there.
  const candidates: unknown[] = [];
  if (Array.isArray(parsed)) {
    for (const block of parsed) {
      const text = (block as { text?: unknown } | null)?.text;
      if (typeof text === "string") {
        try {
          candidates.push(JSON.parse(text));
        } catch {
          // Not JSON -- ignore, the raw-JSON fallback view still covers it.
        }
      }
    }
  }
  if (candidates.length === 0) candidates.push(parsed);

  for (const candidate of candidates) {
    const rows = findRowArray(candidate);
    if (rows) return rows;
  }
  // A single record (e.g. get_current_user) -- one row, not the envelope.
  const record = candidates.find(
    (candidate): candidate is SourceRow =>
      candidate !== null && typeof candidate === "object" && !Array.isArray(candidate),
  );
  return record ? [record] : null;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

// One level of nested plain-object fields (YouTrack's customFields, e.g.
// {Priority, Type, State}) is flattened into its own columns instead of
// showing as an unreadable "[object Object]" cell.
function flattenRow(row: SourceRow): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        flat[subKey] = formatCellValue(subValue);
      }
    } else {
      flat[key] = formatCellValue(value);
    }
  }
  return flat;
}

// Collapsed by default -- the answer is the point; the raw data behind it is
// one click away for anyone who wants to check it.
function SourceBlock({ source }: { source: ChatSource }) {
  const rows = extractSourceRows(source.value)?.map(flattenRow) ?? null;
  const columns = rows ? Array.from(new Set(rows.flatMap((row) => Object.keys(row)))) : [];
  return (
    <details className="group/source rounded-md border border-[color:var(--border-glass)] bg-[color:var(--surface-glass)] text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Database aria-hidden="true" className="size-3.5" />
        <span>
          Source: <span className="font-medium text-foreground">{source.label}</span>
          {rows ? ` · ${rows.length} ${rows.length === 1 ? "result" : "results"}` : ""}
        </span>
        <span aria-hidden="true" className="ml-auto transition-transform group-open/source:rotate-90">›</span>
      </summary>
      <div className="border-t border-[color:var(--border-glass)] p-2">
        {rows ? (
          <div className="prose-assistant max-h-64 overflow-auto">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((column) => {
                      const value = row[column] ?? "";
                      return (
                        <td key={column}>
                          {isHttpUrl(value) ? (
                            <a href={value} target="_blank" rel="noopener noreferrer">
                              Open ↗
                            </a>
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // No obvious row shape (a scalar, plain text, etc.).
          <pre className="max-h-48 overflow-auto rounded-sm bg-[color:var(--surface-glass-strong)] p-2 whitespace-pre-wrap">
            {formatSourceValue(source.value)}
          </pre>
        )}
      </div>
    </details>
  );
}

function AssistantAvatar() {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-glass-strong)] ring-1 ring-[color:var(--border-glass)]"
    >
      <MessageCircle className="size-3.5 text-[color:var(--accent-peach)]" />
    </span>
  );
}

function isAssistantChunk(value: unknown): value is AssistantChunk {
  const type = (value as { type?: unknown } | null)?.type;
  return typeof value === "object" && value !== null && (type === "text" || type === "source" || type === "error");
}

// Never persisted server-side (Story 5.2) -- this component's own state is
// the entire history; every send resends the running list of user/assistant
// turns (no source lines, those are UI-only) as the request body.
export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message in view as it streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function startNewChat() {
    setMessages([]);
    setError(null);
    setShowHelp(false);
    inputRef.current?.focus();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void ask(input.trim());
  }

  // Shared by the typed input and the capability examples' one-click asks.
  async function ask(question: string) {
    if (!question || pending) {
      return;
    }
    setShowHelp(false);

    setError(null);
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question, sources: [] }];
    setMessages([...nextMessages, { role: "assistant", content: "", sources: [] }]);
    setPending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });

      if (!response.ok) {
        throw new Error(`Assistant request failed: ${response.status}`);
      }
      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // NDJSON -- split on newlines, keep any trailing partial line in
        // the buffer for the next read.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk: unknown;
          try {
            chunk = JSON.parse(line);
          } catch {
            continue;
          }
          if (!isAssistantChunk(chunk)) continue;
          applyChunk(chunk);
        }
      }

      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer);
          if (isAssistantChunk(chunk)) applyChunk(chunk);
        } catch {
          // Incomplete trailing line -- nothing more to do with it.
        }
      }
    } catch {
      setError("Couldn't reach the assistant. Please try again.");
    } finally {
      setPending(false);
      // The textarea was disabled while pending -- hand focus back for the follow-up.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function applyChunk(chunk: AssistantChunk) {
    if (chunk.type === "error") {
      setError(chunk.message);
      return;
    }
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last || last.role !== "assistant") return prev;
      next[next.length - 1] =
        chunk.type === "text"
          ? { ...last, content: last.content + chunk.delta }
          : { ...last, sources: [...last.sources, { label: chunk.label, value: chunk.value }] };
      return next;
    });
  }

  const lastIndex = messages.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Conversation" className="glass flex flex-col overflow-hidden">
        {messages.length > 0 && (
          <div className="flex items-center justify-between border-b border-[color:var(--border-glass)] px-5 py-2.5">
            <span className="text-xs text-muted-foreground">
              {messages.filter((message) => message.role === "user").length} question
              {messages.filter((message) => message.role === "user").length === 1 ? "" : "s"} this session
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={startNewChat} disabled={pending}>
              <RotateCcw />
              New chat
            </Button>
          </div>
        )}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-busy={pending}
          className="flex max-h-[62vh] min-h-[40vh] flex-col gap-6 overflow-y-auto p-5 sm:p-7"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground">
                Ask a question about your YouTrack project data — or pick one of these to start.
              </p>
              <AssistantCapabilities onAsk={ask} disabled={pending} />
            </div>
          ) : (
            messages.map((message, index) =>
              message.role === "user" ? (
                <div key={index} className="flex justify-end">
                  <p className="max-w-[80%] rounded-md rounded-br-sm bg-[rgba(255,139,107,0.16)] px-4 py-2.5 whitespace-pre-wrap text-foreground">
                    <span className="sr-only">You: </span>
                    {message.content}
                  </p>
                </div>
              ) : (
                <div key={index} className="flex gap-3">
                  <AssistantAvatar />
                  <div className="flex min-w-0 max-w-[72ch] flex-1 flex-col gap-2 pt-0.5">
                    <span className="sr-only">Assistant: </span>
                    {message.content ? (
                      <div className="prose-assistant leading-relaxed text-foreground">
                        <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
                      </div>
                    ) : pending && index === lastIndex ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="assistant-typing" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                        {message.sources.length > 0 ? "Reading the results…" : "Checking YouTrack…"}
                      </p>
                    ) : null}
                    {message.sources.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {message.sources.map((source, sourceIndex) => (
                          <SourceBlock key={sourceIndex} source={source} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </section>

      {showHelp && messages.length > 0 && (
        <section id="assistant-help" aria-label="What the assistant can do" className="glass p-5 sm:p-6">
          <AssistantCapabilities onAsk={ask} disabled={pending} />
        </section>
      )}

      {error && (
        <p role="alert" className="px-1 text-sm text-destructive">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="glass flex items-end gap-2 p-2 transition-shadow focus-within:ring-2 focus-within:ring-ring/50"
      >
        {messages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={() => setShowHelp((prev) => !prev)}
            aria-expanded={showHelp}
            aria-controls="assistant-help"
            aria-label="What can I ask?"
            title="What can I ask?"
            className="rounded-full"
          >
            <CircleHelp className="size-5" />
          </Button>
        )}
        <label htmlFor="assistant-input" className="sr-only">
          Ask the assistant
        </label>
        <textarea
          id="assistant-input"
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter adds a line -- the chat-tool default.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask about issues, people, or projects…"
          disabled={pending}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-foreground [field-sizing:content] placeholder:text-[color:var(--ink-muted)] focus:outline-none disabled:opacity-60"
        />
        <Button
          type="submit"
          size="icon-lg"
          disabled={pending || !input.trim()}
          aria-label={pending ? "Asking…" : "Send"}
          title="Send (Enter)"
          className="rounded-full"
        >
          <ArrowUp className="size-5" />
        </Button>
      </form>
      <p className="px-1 text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
    </div>
  );
}
