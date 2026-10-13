import { CardGridSkeleton, PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";

// Leave & Holidays: leave rows, holiday rows, then the entry form panel.
export default function Loading() {
  return (
    <PageSkeleton title="Leave & Holidays">
      <CardGridSkeleton cards={3} grid="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" cardHeight="h-16" />
      <CardGridSkeleton cards={3} grid="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" cardHeight="h-16" />
      <PanelSkeleton rows={3} className="" />
    </PageSkeleton>
  );
}
