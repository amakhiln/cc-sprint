import { Bone, PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";

// Roster: capacity panel, member list, two side-by-side panels, categories.
export default function Loading() {
  return (
    <PageSkeleton title="Team Roster">
      <PanelSkeleton rows={2} />
      <section className="glass mb-8 p-6 sm:p-8">
        <Bone className="mb-5 h-5 w-40" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="glass-row flex items-center gap-4 px-4 py-3">
              <Bone className="size-9 rounded-full" />
              <Bone className="h-4 w-40" />
              <Bone className="ml-auto h-2 w-1/3 rounded-full" />
            </div>
          ))}
        </div>
      </section>
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelSkeleton rows={3} className="" />
        <PanelSkeleton rows={3} className="" />
      </div>
      <PanelSkeleton rows={4} className="" />
    </PageSkeleton>
  );
}
