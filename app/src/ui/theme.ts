/**
 * A small, quiet design vocabulary.
 *
 * The app is a place someone talks to at the end of a hard day, so the surface
 * stays calm and legible rather than bright. One accent, generous spacing, a
 * type scale that reads at arm's length on a couch.
 */

import { StyleSheet } from "react-native";

export const colors = {
  bg: "#12100E", // warm near-black
  surface: "#1E1B18",
  border: "#332E29",
  text: "#F1ECE4",
  textDim: "#A8A199",
  accent: "#C8794E", // terracotta, the one warm signal
  accentText: "#12100E",
  danger: "#C7564E",
  listening: "#6FAE8E", // green while it's your turn to talk
} as const;

export const space = { xs: 6, sm: 10, md: 16, lg: 24, xl: 40 } as const;

export const radius = { sm: 8, md: 14, lg: 22 } as const;

export const type = StyleSheet.create({
  display: { fontSize: 30, fontWeight: "600", color: colors.text, lineHeight: 38 },
  title: { fontSize: 22, fontWeight: "600", color: colors.text },
  body: { fontSize: 17, color: colors.text, lineHeight: 25 },
  dim: { fontSize: 15, color: colors.textDim, lineHeight: 22 },
  mono: { fontSize: 14, color: colors.textDim, fontVariant: ["tabular-nums"] },
});
