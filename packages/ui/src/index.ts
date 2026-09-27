/** Warm Editorial Nuptial. Measurements are device-independent pixels. */
export const colorTokens = {
  background: "#fff8f5", surface: "#fff8f5", surfaceBright: "#fff8f5",
  surfaceDim: "#e0d8d5", surfaceTint: "#52634c",
  surfaceLowest: "#ffffff", surfaceLow: "#faf2ee", surfaceContainer: "#f4ece8",
  surfaceHigh: "#eee7e3", surfaceHighest: "#e9e1dd",
  surfaceVariant: "#e9e1dd",
  text: "#1e1b19", onBackground: "#1e1b19", textMuted: "#444841",
  inverseSurface: "#33302d",
  inverseText: "#f7efeb", outline: "#747870", outlineSubtle: "#c4c8be",
  primary: "#485943", onPrimary: "#ffffff", primaryContainer: "#60725a",
  onPrimaryContainer: "#e2f6d8", primaryFixed: "#d4e8cb",
  primaryFixedDim: "#b9ccb0", onPrimaryFixed: "#101f0d",
  onPrimaryFixedVariant: "#3a4b36", inversePrimary: "#b9ccb0",
  secondary: "#775a19", onSecondary: "#ffffff", secondaryContainer: "#fed488",
  onSecondaryContainer: "#785a1a", secondaryFixed: "#ffdea5",
  secondaryFixedDim: "#e9c176", onSecondaryFixed: "#261900",
  onSecondaryFixedVariant: "#5d4201",
  tertiary: "#5f533a", onTertiary: "#ffffff",
  tertiaryContainer: "#786b51", onTertiaryContainer: "#ffeecf",
  tertiaryFixed: "#f2e0c0", tertiaryFixedDim: "#d5c5a6",
  onTertiaryFixed: "#231a07", onTertiaryFixedVariant: "#51452e",
  error: "#ba1a1a", onError: "#ffffff", errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",
  // Editorial accents from the Stitch prose, separate from structured semantic roles.
  pearlIvory: "#faf8f5", cardIvory: "#fdfbf7", warmAlabaster: "#f4efeb",
  softBeige: "#efe8dd", stoneBorder: "#e7e2da", sageRomance: "#60725a",
  sagePressed: "#505f4b", antiqueGold: "#c5a059",
  antiqueGoldAccessible: "#b38e46", champagne: "#d8c7a8", espresso: "#1c1917",
} as const;

export const fontTokens = {
  displayRegular: "PlayfairDisplay_400Regular",
  displayMedium: "PlayfairDisplay_500Medium",
  displaySemibold: "PlayfairDisplay_600SemiBold",
  displaySemiboldItalic: "PlayfairDisplay_600SemiBold_Italic",
  bodyRegular: "PlusJakartaSans_400Regular",
  bodyMedium: "PlusJakartaSans_500Medium",
  bodySemibold: "PlusJakartaSans_600SemiBold",
  bodyBold: "PlusJakartaSans_700Bold",
} as const;

// Stitch tracking is specified in em; components convert it to pixels.
export const typographyTokens = {
  displayLarge: { font: fontTokens.displaySemibold, size: 44, lineHeight: 52, trackingEm: -0.02 },
  displayMobile: { font: fontTokens.displaySemibold, size: 34, lineHeight: 42, trackingEm: -0.01 },
  headlineLarge: { font: fontTokens.displaySemibold, size: 32, lineHeight: 40, trackingEm: -0.01 },
  headlineMobile: { font: fontTokens.displaySemibold, size: 26, lineHeight: 34, trackingEm: 0 },
  headlineMedium: { font: fontTokens.displayMedium, size: 22, lineHeight: 30, trackingEm: 0 },
  headlineSmall: { font: fontTokens.displayMedium, size: 19, lineHeight: 26, trackingEm: 0 },
  title: { font: fontTokens.bodySemibold, size: 16, lineHeight: 22, trackingEm: 0.01 },
  bodyLarge: { font: fontTokens.bodyRegular, size: 16, lineHeight: 26, trackingEm: 0 },
  body: { font: fontTokens.bodyRegular, size: 14, lineHeight: 22, trackingEm: 0 },
  bodySmall: { font: fontTokens.bodyRegular, size: 12, lineHeight: 18, trackingEm: 0 },
  labelLarge: { font: fontTokens.bodySemibold, size: 13, lineHeight: 18, trackingEm: 0.04 },
  label: { font: fontTokens.bodySemibold, size: 11, lineHeight: 16, trackingEm: 0.06 },
  labelCaps: { font: fontTokens.bodyBold, size: 10, lineHeight: 14, trackingEm: 0.12 },
} as const;

export const spacingTokens = {
  micro: 4, small: 8, medium: 16, margin: 20, large: 24,
  extraLarge: 36, card: 20, cardLarge: 24,
} as const;
export const radiusTokens = {
  small: 4, base: 8, medium: 12, large: 16, extraLarge: 24, pill: 9999,
} as const;
export const borderTokens = {
  hairline: 1,
  card: { width: 1, color: colorTokens.stoneBorder },
  input: { width: 1, color: colorTokens.stoneBorder },
  focus: { width: 2, color: colorTokens.antiqueGold },
} as const;
export const elevationTokens = {
  none: { color: colorTokens.espresso, opacity: 0, radius: 0, offsetX: 0, offsetY: 0, androidElevation: 0 },
  ambient: { color: colorTokens.espresso, opacity: 0.06, radius: 16, offsetX: 0, offsetY: 8, androidElevation: 2 },
  floating: { color: colorTokens.espresso, opacity: 0.08, radius: 24, offsetX: 0, offsetY: 10, androidElevation: 4 },
} as const;
export const stateTokens = {
  success: { foreground: colorTokens.primary, background: colorTokens.primaryFixed },
  warning: { foreground: colorTokens.secondary, background: colorTokens.secondaryContainer },
  error: { foreground: colorTokens.onErrorContainer, background: colorTokens.errorContainer },
  neutral: { foreground: colorTokens.textMuted, background: colorTokens.surfaceContainer },
  disabled: { foreground: colorTokens.outline, background: colorTokens.surfaceHigh },
  focus: colorTokens.antiqueGold,
} as const;
