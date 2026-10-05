"use client";

export default function SprintPlanOverviewError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="mb-4 font-heading text-2xl font-medium text-foreground">Sprint Plan</h1>
      <p className="mb-4 text-muted-foreground">
        Couldn&apos;t load the Sprint plan right now. Please try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="cursor-pointer rounded-sm bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
