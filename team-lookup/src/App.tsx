/* eslint-disable react-refresh/only-export-components -- SITE_COPY is static app config imported by lazy-loaded pages */
import MilestonesPage from "@/pages/MilestonesPage";
import { lazy, Suspense, type JSX } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

/** Public UI copy (edit here). Supabase connection stays in `.env` (`VITE_SUPABASE_*` only). */
export type CommunitySiteCopy = {
  readonly communityName: string;
  readonly communityAbbrev: string;
  readonly brandTagline: string;
  readonly brandHeadline: string;
  readonly aboutSectionHeading: string;
  readonly eventTitle: string;
  readonly eventIntro: string;
  readonly successEmoji: string;
  readonly communitySiteUrl: string;
  readonly communityEventsUrl: string;
  readonly supportEmail: string;
  readonly brandLogoSrc: string;
};

export const SITE_COPY: CommunitySiteCopy = {
  communityName: "Digital Dreamers Den",
  communityAbbrev: "D3",
  brandTagline: "BUILDING THE FUTURE",
  brandHeadline: "Dream. Build. Grow.",
  aboutSectionHeading: "About this event",
  eventTitle: "Welcome to the Anniversary Meetup Activity",
  eventIntro:
    "Find your team name using your registered email. This is your chance to do more than just code—connect, collaborate, and network with the community!",
  successEmoji: "🎉",
  communitySiteUrl: "https://digitaldreamersden.in/",
  communityEventsUrl: "https://digitaldreamersden.in/#events",
  supportEmail: "d3communityofficial@gmail.com",
  // Respect Vite `base` (e.g. GitHub Pages project URL); `/file.png` would miss the repo prefix.
  brandLogoSrc: `${import.meta.env.BASE_URL}full_logo.png`,
};

const TeamLookupPage = lazy(async () => import("@/pages/TeamLookupPage"));

function routerBasename(): string | undefined {
  const baseUrl: string = import.meta.env.BASE_URL;
  const trimmed: string = baseUrl.replace(/\/$/, "");
  return trimmed === "" ? undefined : trimmed;
}

function RouteFallback(): JSX.Element {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)] text-sm font-medium text-muted">
      Loading…
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter basename={routerBasename()}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<TeamLookupPage />} />
          <Route path="/milestones" element={<MilestonesPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
