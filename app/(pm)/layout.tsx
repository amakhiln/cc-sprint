import { TopNav } from "@/components/top-nav";

// Every PM page reads live DB/YouTrack/date state -- render per request.
// Prerendering froze them at build time (e.g. "Day 5 of 14" never advancing,
// YouTrack changes never showing) until some action happened to revalidate.
export const dynamic = "force-dynamic";

// Wraps every PM-facing page (Sprint Plan, Roster, Backlog, Leave &
// Holidays, Velocity History, Settings) with a persistent nav bar so each
// page is actually reachable from every other one. Deliberately does NOT
// wrap app/share/[token]/ -- that route sits outside this group entirely
// and must show zero PM chrome (AD-4, EXPERIENCE.md "no nav chrome at all").
export default function PmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
