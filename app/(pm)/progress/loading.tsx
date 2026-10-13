import { Bone, PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";

// Progress: sprint pill, five stat tiles, burndown chart, members, issues.
export default function Loading() {
  return (
    <PageSkeleton title="Progress" pill>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="glass flex flex-col gap-2 p-4">
            <Bone className="h-3 w-16" />
            <Bone className="h-7 w-20" />
          </div>
        ))}
      </div>
      <section className="glass mb-8 p-6">
        <Bone className="mb-5 h-5 w-32" />
        <Bone className="h-56 w-full" />
      </section>
      <PanelSkeleton rows={4} />
      <PanelSkeleton rows={6} className="" />
    </PageSkeleton>
  );
}
