import { Bone, PageSkeleton } from "@/components/page-skeleton";

// Velocity History: one table of closed Sprints (Sprint, trend bar, numbers).
export default function Loading() {
  return (
    <PageSkeleton title="Velocity History">
      <section className="glass p-6 sm:p-8">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 border-t border-border pt-4 first:border-t-0 first:pt-0">
              <Bone className="h-4 w-40" />
              <Bone className="h-2 w-32 rounded-full" />
              <Bone className="ml-auto h-4 w-12" />
              <Bone className="h-4 w-12" />
              <Bone className="h-4 w-12" />
            </div>
          ))}
        </div>
      </section>
    </PageSkeleton>
  );
}
