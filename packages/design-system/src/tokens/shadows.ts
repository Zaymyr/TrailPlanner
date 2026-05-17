export const shadows = {
  sm: "0 1px 3px rgba(45, 80, 22, 0.04), 0 1px 2px rgba(31, 36, 16, 0.04)",
  md: "0 10px 24px rgba(45, 80, 22, 0.06), 0 2px 8px rgba(31, 36, 16, 0.05)",
  lg: "0 24px 56px rgba(45, 80, 22, 0.08), 0 8px 20px rgba(31, 36, 16, 0.06)",
} as const;

export type Shadows = typeof shadows;
