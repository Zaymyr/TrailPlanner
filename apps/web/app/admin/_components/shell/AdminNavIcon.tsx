import type { ReactNode } from "react";

import type { AdminNavIcon as AdminNavIconName } from "../../admin-routes";

/** Line icons of the sidebar (same strokes as the ADR mock-up). */
const PATHS: Record<AdminNavIconName, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" />
    </>
  ),
  analytics: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 5-6" />
    </>
  ),
  billing: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  runners: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-1a6 6 0 0 1 12 0v1" />
      <path d="M16 3.5a4 4 0 0 1 0 7" />
      <path d="M22 21v-1a5 5 0 0 0-3-4.6" />
    </>
  ),
  organizers: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  races: <path d="m3 20 6-12 4 7 3-5 5 10z" />,
  products: (
    <>
      <path d="M7 3h10l-1 6H8z" />
      <path d="M8 9v9a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3V9" />
    </>
  ),
  partners: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </>
  ),
  studio: (
    <>
      <rect x="2" y="5" width="15" height="14" rx="2" />
      <path d="m17 10 5-3v10l-5-3" />
    </>
  ),
  posts: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" />
    </>
  ),
  renders: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  flyovers: (
    <>
      <path d="m2 18 7-9 5 6 3-4 5 7z" />
      <circle cx="17" cy="6" r="2" />
    </>
  ),
  messages: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  surveys: (
    <>
      <path d="M9 11h6M9 15h4" />
      <rect x="4" y="3" width="16" height="18" rx="2" />
    </>
  ),
  automation: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.4 15H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.8H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  integrations: <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" />,
  maintenance: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />,
  audit: (
    <>
      <path d="M12 8v4l3 2" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
};

export function AdminNavIcon({ name, className }: { name: AdminNavIconName; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className ?? "h-[17px] w-[17px] shrink-0 opacity-90"}>
      {PATHS[name]}
    </svg>
  );
}
