export const fonts = {
  bricolageGrotesque: {
    family: "Bricolage Grotesque",
    googleFontsPackage: "@expo-google-fonts/bricolage-grotesque",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@300;400;500;600;700&display=swap",
  },
  jetbrainsMono: {
    family: "JetBrains Mono",
    googleFontsPackage: "@expo-google-fonts/jetbrains-mono",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap",
  },
} as const;

export type Fonts = typeof fonts;
