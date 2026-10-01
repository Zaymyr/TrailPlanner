export const colors = {
  brand: {
    forest: "#2D5016",
    forestLight: "#3F6B1F",
    forestDark: "#1F3810",
    secondary: "#3F6F8F",
    surface: "#E8F0E0",
    border: "#B5CC9A",
  },
  surface: {
    sand: "#ECEAE3",
    sandLight: "#F4F2EC",
    white: "#FFFFFF",
    cream: "#FAF8F2",
    muted: "#EAE8E1",
  },
  text: {
    primary: "#1F2410",
    secondary: "#5C6450",
    tertiary: "#8A917E",
    inverse: "#FAF8F2",
  },
  accent: {
    terracotta: "#E05252",
    amber: "#F0873A",
    olive: "#C8D44E",
  },
  border: {
    subtle: "#E5E2D8",
    strong: "#C9C5B8",
    brand: "#2D5016",
  },
  semantic: {
    success: "#2D5016",
    danger: "#C0392B",
    dangerSurface: "#FDECEA",
    warning: "#D97706",
    warningSurface: "#FEF3C7",
  },
} as const;

export type Colors = typeof colors;
