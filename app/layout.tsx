import type { Metadata } from "next";
import "./globals.css";
import { SpotlightCards } from "@/components/spotlight-cards";

export const metadata: Metadata = {
  title: "Sprint & Velocity Planner",
  description: "Sprint capacity planning and velocity tracking",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Space Grotesk (display/headings) + IBM Plex Sans (body) --
            "Modern Technical" pairing, chosen 2026-08-24 to replace the
            original General Sans + Satoshi (DESIGN.md's Aurora Light spec).
            Both are on Google Fonts, so this loads via the standard CSS2
            API instead of the prior Fontshare CDN link. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&family=IBM+Plex+Sans:wght@400;500;700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SpotlightCards />
        {children}
      </body>
    </html>
  );
}
