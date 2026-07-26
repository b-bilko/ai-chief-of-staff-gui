/**
 * The handful of shared components the screens are assembled from.
 */

import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, space, type } from "./theme";
import type { Phase } from "../core/flowState";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.screenInner}>{children}</View>
    </SafeAreaView>
  );
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const toneStyle =
    tone === "primary" ? styles.btnPrimary : tone === "danger" ? styles.btnDanger : styles.btnGhost;
  const textStyle = tone === "primary" ? styles.btnPrimaryText : styles.btnGhostText;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, toneStyle, pressed && styles.btnPressed, disabled && styles.btnDisabled]}
    >
      <Text style={[styles.btnText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

/** The big status word at the top of an interview screen. */
export function PhaseIndicator({ phase }: { phase: Phase }) {
  const { label, color, busy } = PHASE_PRESENTATION[phase];
  return (
    <View style={styles.phaseRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[type.title, { color }]}>{label}</Text>
      {busy ? <ActivityIndicator color={color} style={{ marginLeft: space.sm }} /> : null}
    </View>
  );
}

const PHASE_PRESENTATION: Record<Phase, { label: string; color: string; busy: boolean }> = {
  idle: { label: "Ready", color: colors.textDim, busy: false },
  thinking: { label: "Working", color: colors.accent, busy: true },
  speaking: { label: "Speaking", color: colors.accent, busy: false },
  listening: { label: "Listening", color: colors.listening, busy: false },
  reviewing: { label: "Check this", color: colors.text, busy: false },
  done: { label: "Done", color: colors.listening, busy: false },
};

export function Banner({ text, tone = "info" }: { text: string; tone?: "info" | "danger" }) {
  return (
    <View style={[styles.banner, tone === "danger" && styles.bannerDanger]}>
      <Text style={type.dim}>{text}</Text>
    </View>
  );
}

/** A dollars figure, small and unobtrusive; the user pays directly. */
export function Cost({ usd }: { usd: number }) {
  if (usd <= 0) return null;
  return <Text style={type.mono}>${usd.toFixed(3)}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenInner: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  btn: { paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.md, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  btnDanger: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.danger },
  btnPressed: { opacity: 0.7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 17, fontWeight: "600" },
  btnPrimaryText: { color: colors.accentText },
  btnGhostText: { color: colors.text },
  phaseRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  banner: { backgroundColor: colors.surface, borderRadius: radius.sm, padding: space.md, borderWidth: 1, borderColor: colors.border },
  bannerDanger: { borderColor: colors.danger },
});
