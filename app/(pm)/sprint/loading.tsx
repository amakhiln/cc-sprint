import { Bone, PageSkeleton } from "@/components/page-skeleton";

// Backlog: the active-Sprint summary panel, then the inline YouTrack backlog.
export default function Loading() {
  return (
    <PageSkeleton title="Backlog">
      <section className="glass flex flex-wrap items-center justify-between gap-6 p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <Bone className="size-11 rounded-full" />
          <div className="flex flex-col gap-2">
            <Bone className="h-3 w-24" />
            <Bone className="h-5 w-52" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Bone className="h-10 w-16" />
          <Bone className="h-8 w-28 rounded-full" />
        </div>
      </section>
      <BacklogListSkeleton />
    </PageSkeleton>
  );
}

function BacklogListSkeleton() {
  return (
    <section className="glass mt-8 p-6 sm:p-8">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Bone className="h-5 w-40" />
          <Bone className="h-4 w-80" />
        </div>
        <Bone className="h-7 w-24" />
      </div>
      <Bone className="mb-3 h-9 w-full" />
      <div className="mb-4 flex gap-1.5">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass-row flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bone className="size-4" />
              <Bone className="h-4 flex-1" />
              <Bone className="h-3 w-16" />
            </div>
            <div className="flex justify-between">
              <Bone className="h-3 w-32" />
              <Bone className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
