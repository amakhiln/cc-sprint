"use client";

// App-styled renderers for A2UI v0.9's standard components (the basic
// catalog's own APIs and schemas, so surfaces stay plain A2UI JSON) --
// rendered with this app's tokens instead of the basic catalog's generic
// look. Registered in appCatalog (result-table.tsx) next to ResultTable.
import { createContext, Fragment, useContext, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { createComponentImplementation } from "@a2ui/react/v0_9";
import { ButtonApi, ColumnApi, DividerApi, RowApi, TabsApi, TextApi } from "@a2ui/web_core/v0_9";
import { Button as UiButton } from "@/components/ui/button";

// Set by assistant-surface.tsx: actions that would send a question are
// disabled while an answer is still streaming.
export const AskContext = createContext<{ disabled: boolean }>({ disabled: false });

type ChildRef = string | { id: string; basePath?: string };
type BuildChild = (id: string, basePath?: string) => ReactNode;

function Children({ list, buildChild }: { list: unknown; buildChild: BuildChild }) {
  if (!Array.isArray(list)) return null;
  return (list as ChildRef[]).map((ref, index) =>
    typeof ref === "string" ? (
      <Fragment key={`${ref}-${index}`}>{buildChild(ref)}</Fragment>
    ) : (
      <Fragment key={`${ref.id}-${ref.basePath ?? index}`}>{buildChild(ref.id, ref.basePath)}</Fragment>
    ),
  );
}

const JUSTIFY: Record<string, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  spaceBetween: "justify-between",
  spaceAround: "justify-around",
  spaceEvenly: "justify-evenly",
};
const ALIGN: Record<string, string> = { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch" };

type LayoutProps = { children?: unknown; justify?: string; align?: string; weight?: number };

export const Column = createComponentImplementation(ColumnApi, ({ props, buildChild }) => {
  const p = props as LayoutProps;
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 ${JUSTIFY[p.justify ?? ""] ?? ""} ${ALIGN[p.align ?? ""] ?? ""}`}
      style={p.weight ? { flexGrow: p.weight } : undefined}
    >
      <Children list={p.children} buildChild={buildChild as BuildChild} />
    </div>
  );
});

// Wraps: a row of prompt chips shouldn't scroll sideways on a phone.
export const Row = createComponentImplementation(RowApi, ({ props, buildChild }) => {
  const p = props as LayoutProps;
  return (
    <div
      className={`flex min-w-0 flex-wrap gap-2 pt-1 ${JUSTIFY[p.justify ?? ""] ?? ""} ${ALIGN[p.align ?? "center"] ?? ""}`}
      style={p.weight ? { flexGrow: p.weight } : undefined}
    >
      <Children list={p.children} buildChild={buildChild as BuildChild} />
    </div>
  );
});

const TEXT_CLASS: Record<string, string> = {
  h1: "font-heading text-2xl font-medium text-foreground text-balance",
  h2: "font-heading text-xl font-medium text-foreground text-balance",
  h3: "font-heading text-lg font-medium text-foreground text-balance",
  h4: "font-heading text-base font-medium text-foreground text-balance",
  h5: "text-sm font-medium text-foreground",
  body: "text-sm text-foreground text-pretty",
  caption: "text-xs leading-relaxed text-muted-foreground text-pretty",
};
const HEADING_TAG: Record<string, "h3" | "h4" | "h5"> = { h1: "h3", h2: "h3", h3: "h3", h4: "h4", h5: "h5" };

// Plain text, never HTML -- every string comes from app code, but nothing
// here should ever be able to inject markup.
export const Text = createComponentImplementation(TextApi, ({ props }) => {
  const p = props as { text?: unknown; variant?: string };
  const variant = p.variant ?? "body";
  const value = typeof p.text === "string" ? p.text : String(p.text ?? "");
  const Tag = HEADING_TAG[variant] ?? "p";
  return <Tag className={`${TEXT_CLASS[variant] ?? TEXT_CLASS.body} max-w-[72ch]`}>{value}</Tag>;
});

// "default" is the prompt chip that asks a question; "primary" and
// "borderless" map to the app's own button styles.
export const Button = createComponentImplementation(ButtonApi, ({ props, buildChild }) => {
  const p = props as {
    child?: string;
    variant?: string;
    action?: () => void;
    isValid?: boolean;
    accessibility?: { label?: string };
  };
  const { disabled: asking } = useContext(AskContext);
  const disabled = asking || p.isValid === false;
  const label = p.child ? (buildChild as BuildChild)(p.child) : null;
  if (p.variant === "primary" || p.variant === "borderless") {
    return (
      <UiButton
        type="button"
        variant={p.variant === "primary" ? "default" : "link"}
        size="sm"
        onClick={p.action}
        disabled={disabled}
        aria-label={p.accessibility?.label}
      >
        {label}
      </UiButton>
    );
  }
  return (
    <button
      type="button"
      onClick={p.action}
      disabled={disabled}
      aria-label={p.accessibility?.label}
      className="group/ask inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-[color:var(--surface-glass-strong)] px-3 py-1.5 text-left ring-1 ring-[color:var(--border-glass)] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-white hover:ring-[color:var(--accent-peach)]/40 focus-visible:ring-2 focus-visible:ring-[color:var(--accent-peach)] focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[color:var(--surface-glass-strong)] motion-reduce:transition-none motion-reduce:active:scale-100 [&_p]:text-xs"
    >
      {label}
      <ArrowUpRight
        aria-hidden="true"
        className="size-3.5 shrink-0 text-[color:var(--accent-peach)] transition-transform duration-150 ease-out group-hover/ask:translate-x-px group-hover/ask:-translate-y-px motion-reduce:transition-none"
      />
    </button>
  );
});

export const Divider = createComponentImplementation(DividerApi, ({ props }) => {
  const vertical = (props as { axis?: string }).axis === "vertical";
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={vertical ? "mx-2 w-px self-stretch bg-foreground/10" : "my-2 h-px w-full bg-foreground/10"}
    />
  );
});

// WAI-ARIA tabs: arrow keys / Home / End move between tabs (automatic
// activation), only the selected tab is in the tab order.
export const Tabs = createComponentImplementation(TabsApi, ({ props, buildChild }) => {
  const tabs = ((props as { tabs?: { title?: unknown; child: string }[] }).tabs ?? []).map((tab) => ({
    title: typeof tab.title === "string" ? tab.title : String(tab.title ?? ""),
    child: tab.child,
  }));
  const [selected, setSelected] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const active = tabs[selected] ?? tabs[0];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (selected === last ? 0 : selected + 1)
      : event.key === "ArrowLeft" ? (selected === 0 ? last : selected - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
    refs.current[next]?.focus();
  }

  if (!active) return null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div
        role="tablist"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]"
      >
        {tabs.map((tab, index) => {
          const isSelected = index === selected;
          return (
            <button
              key={`${tab.child}-${index}`}
              ref={(node) => {
                refs.current[index] = node;
              }}
              id={`${baseId}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelected(index)}
              className={`shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[color:var(--accent-peach)] focus-visible:outline-none motion-reduce:transition-none ${
                isSelected
                  ? "bg-[color:var(--surface-glass-strong)] font-medium text-foreground shadow-[0_1px_2px_rgba(52,48,44,0.08)] ring-1 ring-[color:var(--border-glass)]"
                  : "text-muted-foreground hover:bg-[color:var(--surface-glass)] hover:text-foreground"
              }`}
            >
              {tab.title}
            </button>
          );
        })}
      </div>
      <div
        key={selected}
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${selected}`}
        tabIndex={0}
        className="a2ui-tab-panel min-w-0 rounded-md focus-visible:ring-2 focus-visible:ring-[color:var(--accent-peach)]/60 focus-visible:outline-none"
      >
        {(buildChild as BuildChild)(active.child)}
      </div>
    </div>
  );
});

export const A2UI_BASIC_COMPONENTS = [Column, Row, Text, Button, Divider, Tabs];
