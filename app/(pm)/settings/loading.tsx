import { PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";

// Settings: the narrower column with its two connection panels.
export default function Loading() {
  return (
    <PageSkeleton title="Settings" width="max-w-3xl">
      <PanelSkeleton rows={3} />
      <PanelSkeleton rows={3} className="" />
    </PageSkeleton>
  );
}
