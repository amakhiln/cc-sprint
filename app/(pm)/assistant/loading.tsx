import { Bone } from "@/components/page-skeleton";

// Assistant: full-height chat -- a couple of message bubbles and the composer
// pinned at the bottom, matching the page's own container (no header row).
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-6xl flex-col px-4 sm:px-6"
    >
      <span className="sr-only">Loading Assistant…</span>
      <div className="flex flex-1 flex-col gap-4 py-6">
        <Bone className="h-16 w-2/3 self-end rounded-2xl" />
        <Bone className="h-28 w-3/4 rounded-2xl" />
      </div>
      <div className="glass sticky bottom-4 mb-4 flex items-center gap-3 p-3">
        <Bone className="h-10 flex-1" />
        <Bone className="size-10 rounded-full" />
      </div>
    </div>
  );
}
