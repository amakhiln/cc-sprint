import { getProgressData } from "@/app/progress-data";
import { ProgressView } from "@/components/progress-view";

// Logged time is read live from YouTrack on every request -- never prerender
// or cache this page.
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const data = await getProgressData();
  return <ProgressView data={data} />;
}
