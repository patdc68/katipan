import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";

const playfairDisplay = localFont({
  src: "../../../../node_modules/@expo-google-fonts/playfair-display/600SemiBold/PlayfairDisplay_600SemiBold.ttf",
  variable: "--font-playfair-display",
  weight: "600",
  display: "swap",
});

const plusJakartaSans = localFont({
  src: [
    { path: "../../../../node_modules/@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf", weight: "400" },
    { path: "../../../../node_modules/@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf", weight: "600" },
    { path: "../../../../node_modules/@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf", weight: "700" },
  ],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KATIPAN",
  description: "One wedding. One source of truth.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${playfairDisplay.variable} ${plusJakartaSans.variable}`}>{children}</body>
    </html>
  );
}
