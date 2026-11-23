/**
 * Vitest stand-in for `next/font/google` (the real loader only runs inside the Next.js compiler). Every
 * font factory returns the shape components read: a class name, a CSS variable class and a style.
 */
type FontOptions = { variable?: string };

const createFont = (options: FontOptions = {}) => ({
  className: "next-font-stub",
  variable: options.variable ? `next-font-stub-${options.variable.replace(/^--/, "")}` : "next-font-stub",
  style: { fontFamily: "system-ui" },
});

export const Bricolage_Grotesque = createFont;
export const JetBrains_Mono = createFont;
export const Inter = createFont;
