import { Bone, PageSkeleton } from "@/components/page-skeleton";

// Backlog: drawer button in the header, then the active-Sprint summary panel.
export default function Loading() {
  return (
    <PageSkeleton title="Backlog" actions={1}>
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
    </PageSkeleton>
  );
}
