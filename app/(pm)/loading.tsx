import { Bone, CardGridSkeleton, PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";

// Sprint Plan: header pill + actions, team capacity ledger, member cards, issues.
export default function Loading() {
  return (
    <PageSkeleton title="Sprint Plan" pill actions={3}>
      <section className="glass mb-8 p-6 sm:p-8">
        <Bone className="mb-4 h-5 w-48" />
        <Bone className="mb-3 h-3 w-full rounded-full" />
        <Bone className="h-4 w-64" />
      </section>
      <CardGridSkeleton cards={6} cardHeight="h-36" />
      <PanelSkeleton rows={5} className="" />
    </PageSkeleton>
  );
}
