"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUp, CircleHelp, MessageCircle, RotateCcw } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import type { AssistantChunk } from "@/infrastructure/query-assistant/client";
import { buildHelpSurface } from "@/app/api/assistant/help";
import { isAssistantChunk } from "./chunk";

// @a2ui/react isn't SSR-safe -- client-only. Renders every A2UI surface:
// the issue picker and the read-only result tables alike.
const AssistantSurface = dynamic(() => import("./assistant-surface"), {
  ssr: false,
});

// The help guide (A2UI) shown on an empty chat and behind the "?" button --
// the same surface the assistant answers "what can you do?" with.
const WELCOME_GUIDE = buildHelpSurface("help-welcome");
const PANEL_GUIDE = buildHelpSurface("help-panel");

type ChatStep = Omit<Extract<AssistantChunk, { type: "step" }>, "type">;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  // Tool calls as they run, merged by id (running -> done/failed).
  steps: ChatStep[];
  // A2UI surfaces (issue picker, tool-result lists) -- UI-only, never
  // resent to the model.
  surfaces: unknown[];
};

function surfaceId(surface: unknown): string {
  const id = (surface as { surfaceId?: unknown } | null)?.surfaceId;
  return typeof id === "string" ? id : "";
}

// A later issue picker (list, then narrow to chosen ids) supersedes the
// surfaces before it -- the same rows shouldn't show twice.
function surfacesBefore(surfaces: unknown[], incoming: unknown): unknown[] {
  return surfaceId(incoming).startsWith("picker-") ? [] : surfaces;
}

function mergeStep(steps: ChatStep[], chunk: Extract<AssistantChunk, { type: "step" }>): ChatStep[] {
  const step: ChatStep = {
    id: chunk.id,
    name: chunk.name,
    args: chunk.args,
    status: chunk.status,
    summary: chunk.summary,
  };
  return steps.some((existing) => existing.id === step.id)
    ? steps.map((existing) => (existing.id === step.id ? step : existing))
    : [...steps, step];
}

// "list_backlog_issues" -> "List backlog issues".
function toolLabel(name: string): string {
  const words = name.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// `type: "Task", estimate: "without"` -- trimmed so one step stays one line.
function argsLabel(args: Record<string, unknown>): string {
  const text = Object.entries(args)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(", ");
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

const STEP_DOT = {
  running: "bg-[color:var(--accent-peach)] motion-safe:animate-pulse",
  done: "bg-[color:var(--accent-mint)]",
  failed: "bg-destructive",
} as const;

// One tool call, Claude Code-style: "● Tool(args)" then "⎿ result".
function StepLine({ step }: { step: ChatStep }) {
  return (
    <li className="flex flex-col gap-0.5 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${STEP_DOT[step.status]}`} />
        <span className="shrink-0 font-medium text-foreground">{toolLabel(step.name)}</span>
        {Object.keys(step.args).length > 0 && (
          <span className="truncate font-mono text-muted-foreground">({argsLabel(step.args)})</span>
        )}
      </div>
      <div className={`flex gap-1.5 pl-1 ${step.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
        <span aria-hidden="true">⎿</span>
        <span>{step.status === "running" ? "Running…" : (step.summary ?? (step.status === "done" ? "Done" : "Failed"))}</span>
      </div>
    </li>
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

// Never persisted server-side (Story 5.2) -- this component's own state is
// the entire history; every send resends the running list of user/assistant
// turns (no source lines, those are UI-only) as the request body.
export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const lastQuestionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Ticked ids per picker surface, sent with each question so "add the
  // selected ones" works from the chat. A ref: ticking shouldn't re-render.
  const selectionsRef = useRef(new Map<string, string[]>());
  const reportSelection = useCallback((surfaceId: string, ids: string[]) => {
    selectionsRef.current.set(surfaceId, ids);
  }, []);
  const questionCount = messages.filter((message) => message.role === "user").length;

  // ChatGPT-style: each new question scrolls to the top of the page view and
  // its answer streams in below it. Only on a new question -- never while
  // the answer streams, so reading back up isn't yanked away.
  useEffect(() => {
    if (questionCount === 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastQuestionRef.current?.scrollIntoView({
      block: "start",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [questionCount]);

  function startNewChat() {
    setMessages([]);
    selectionsRef.current.clear();
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
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question, steps: [], surfaces: [] }];
    setMessages([...nextMessages, { role: "assistant", content: "", steps: [], surfaces: [] }]);
    setPending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({
            role,
            content,
          })),
          selectedIssueIds: Array.from(new Set([...selectionsRef.current.values()].flat())),
        }),
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
          : chunk.type === "ui"
            ? {
                ...last,
                surfaces: [...surfacesBefore(last.surfaces, chunk.surface), chunk.surface],
              }
            : { ...last, steps: mergeStep(last.steps, chunk) };
      return next;
    });
  }

  const lastIndex = messages.length - 1;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <section aria-label="Conversation" className="flex flex-1 flex-col">
        {messages.length > 0 && (
          <div className="flex items-center justify-between border-b border-[color:var(--border-glass)] pb-2">
            <span className="text-xs text-muted-foreground">
              {questionCount} question{questionCount === 1 ? "" : "s"} this session
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={startNewChat} disabled={pending}>
              <RotateCcw />
              New chat
            </Button>
          </div>
        )}
        <div role="log" aria-live="polite" aria-busy={pending} className="flex flex-1 flex-col gap-6 py-6">
          {messages.length === 0 ? (
            <AssistantSurface surface={WELCOME_GUIDE} onAsk={ask} askDisabled={pending} />
          ) : (
            messages.map((message, index) =>
              message.role === "user" ? (
                // scroll-mt clears the sticky TopNav when scrolled into view.
                <div
                  key={index}
                  ref={index === lastIndex - 1 || index === lastIndex ? lastQuestionRef : undefined}
                  className="flex scroll-mt-24 justify-end"
                >
                  <p className="max-w-[80%] rounded-md rounded-br-sm bg-[rgba(255,139,107,0.16)] px-4 py-2.5 whitespace-pre-wrap text-foreground">
                    <span className="sr-only">You: </span>
                    {message.content}
                  </p>
                </div>
              ) : (
                // The latest answer reserves most of a screen, so its question
                // can always scroll to the top even while the answer is short.
                <div key={index} className={`flex gap-3 ${index === lastIndex ? "min-h-[calc(100dvh-16rem)]" : ""}`}>
                  <AssistantAvatar />
                  <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
                    <span className="sr-only">Assistant: </span>
                    {message.steps.length > 0 && (
                      <ul aria-label="What the assistant did" className="flex flex-col gap-2">
                        {message.steps.map((step) => (
                          <StepLine key={step.id} step={step} />
                        ))}
                      </ul>
                    )}
                    {message.content ? (
                      <div className="prose-assistant max-w-[72ch] leading-relaxed text-foreground">
                        <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
                      </div>
                    ) : pending && index === lastIndex && !message.steps.some((step) => step.status === "running") ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="assistant-typing" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                        {message.steps.length > 0 ? "Reading the results…" : "Thinking…"}
                      </p>
                    ) : null}
                    {message.surfaces.map((surface, surfaceIndex) => (
                      <AssistantSurface
                        key={surfaceId(surface) || surfaceIndex}
                        surface={surface}
                        onSelectionChange={reportSelection}
                        onAsk={ask}
                        askDisabled={pending}
                      />
                    ))}
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </section>

      {showHelp && messages.length > 0 && (
        <section id="assistant-help" aria-label="What the assistant can do">
          <AssistantSurface surface={PANEL_GUIDE} onAsk={ask} askDisabled={pending} />
        </section>
      )}

      {error && (
        <p role="alert" className="px-1 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Composer stays pinned to the bottom of the window while the page scrolls. */}
      {/* Blur (not a solid fill) so the fixed canvas mesh shows through; masked
          so scrolled content fades out softly above the composer. */}
      <div className="sticky bottom-0 z-10 flex flex-col gap-2 pt-4 pb-4 backdrop-blur-md [mask-image:linear-gradient(to_bottom,transparent,black_1rem)]">
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
    </div>
  );
}
