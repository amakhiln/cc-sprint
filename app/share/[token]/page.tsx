import { notFound } from "next/navigation";
import { shareTokenRepository } from "@/infrastructure/db/share-token-repository";
import { getSprintPlanData } from "@/app/sprint-plan-data";
import { SprintPlanContent } from "@/components/sprint-plan-content";

// Story 4.4 -- the read-only Team View (AD-4). Structurally isolated: this
// file and everything it imports (getSprintPlanData, SprintPlanContent) may
// never reach an app/actions/ Server Action. No nav chrome, no edit
// affordances, no login -- gated only by the token matching (a plain
// equality check; AD-5/epic-4-context both frame this as defense-in-depth,
// not real access control).
export default async function TeamViewPage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const shareToken = await shareTokenRepository.get();
  if (!shareToken || shareToken.token !== token) {
    notFound();
  }

  const data = await getSprintPlanData();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Read Only</p>
      <h1 className="mb-6 font-heading text-2xl font-medium text-foreground">Sprint Plan</h1>

      {!data ? (
        <section className="glass p-6 sm:p-8">
          <p className="text-muted-foreground">No active Sprint right now.</p>
        </section>
      ) : (
        <SprintPlanContent data={data} />
      )}
    </div>
  );
}
