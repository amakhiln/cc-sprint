// Route loading skeletons (app/(pm)/*/loading.tsx). Each loader mirrors its
// page's real layout -- same container width, title, glass panels and grids --
// so navigating from the TopNav shows the page's shape instantly instead of a
// blank gap, and nothing jumps when the content streams in.

// A placeholder block. Pulses only for users who allow motion.
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-sm bg-[color:var(--surface-glass-strong)] motion-safe:animate-pulse ${className}`} />;
}

export function PageSkeleton({
  title,
  width = "max-w-6xl",
  pill = false,
  actions = 0,
  children,
}: {
  title: string;
  width?: string;
  pill?: boolean;
  actions?: number;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={`mx-auto w-full ${width} px-6 pt-6 pb-12`}>
      <span className="sr-only">Loading {title}…</span>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--border-glass)] pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <p aria-hidden="true" className="font-heading text-2xl font-medium text-foreground sm:text-3xl">
            {title}
          </p>
          {pill && <Bone className="h-6 w-56 rounded-full" />}
        </div>
        {actions > 0 && (
          <div className="flex items-center gap-3">
            {Array.from({ length: actions }, (_, i) => (
              <Bone key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// A glass section with a heading bar and `rows` line placeholders.
export function PanelSkeleton({ rows = 3, className = "mb-8" }: { rows?: number; className?: string }) {
  return (
    <section className={`glass p-6 sm:p-8 ${className}`}>
      <Bone className="mb-5 h-5 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Bone key={i} className={`h-4 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </section>
  );
}

// A grid of glass-row cards inside a glass section (member cards, leave rows).
export function CardGridSkeleton({
  cards = 6,
  grid = "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  cardHeight = "h-28",
}: {
  cards?: number;
  grid?: string;
  cardHeight?: string;
}) {
  return (
    <section className="glass mb-8 p-6 sm:p-8">
      <Bone className="mb-5 h-5 w-40" />
      <div className={`grid gap-4 ${grid}`}>
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className={`glass-row flex flex-col justify-center gap-3 px-5 py-4 ${cardHeight}`}>
            <Bone className="h-4 w-1/2" />
            <Bone className="h-2 w-full rounded-full" />
            <Bone className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </section>
  );
}
