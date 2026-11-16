/**
 * Sticky in-page navigation, like the RaceBook tabs in the app: one tap jumps
 * to the information a runner is looking for instead of scrolling the page.
 */
export function RaceSectionTabs({ tabs }: { tabs: Array<{ id: string; label: string }> }) {
  if (tabs.length < 2) return null;
  return (
    <nav
      aria-label="Sections de la course"
      className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-2"
    >
      <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
        {tabs.map((tab) => (
          <li key={tab.id} className="shrink-0">
            <a
              href={`#${tab.id}`}
              className="inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-semibold text-muted-foreground transition hover:bg-brand-surface hover:text-brand"
            >
              {tab.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
