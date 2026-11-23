import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";

/** Brand faces scoped to the race plan (the rest of the site keeps its stack). */
export const planDisplayFont = Bricolage_Grotesque({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-plan-display", display: "swap" });
export const planMonoFont = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plan-mono", display: "swap" });
export const planFontVariables = `${planDisplayFont.variable} ${planMonoFont.variable}`;
