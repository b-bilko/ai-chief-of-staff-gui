/**
 * The morning briefing: press once, listen. It writes nothing; its whole output
 * is the spoken text, which streams in as it is generated and scrolls alongside
 * for skimming.
 */

import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Banner, Button, Cost, PhaseIndicator, Screen } from "../components";
import { useFlow } from "../useFlow";
import { colors, radius, space, type } from "../theme";
import type { AgentEvent } from "../../agent/types";
import type { RunResult } from "../../agent/session";

export interface BriefingScreenProps {
  start: (onEvent: (event: AgentEvent) => void) => Promise<RunResult>;
  onExit: () => void;
}

export function BriefingScreen({ start, onExit }: BriefingScreenProps) {
  const { view, running, begin } = useFlow({ start });
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [view.spokenText]);

  if (!running && view.phase === "idle") {
    return (
      <Screen>
        <Text style={type.display}>Good morning</Text>
        <Text style={type.dim}>A short read on your day, out loud.</Text>
        <View style={{ flex: 1 }} />
        <Button label="Brief me" onPress={begin} />
        <Button label="Back" tone="ghost" onPress={onExit} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <PhaseIndicator phase={view.phase} />
        <Cost usd={view.costUsd} />
      </View>
      {view.error ? <Banner tone="danger" text={view.error} /> : null}
      <ScrollView ref={scrollRef} style={styles.box} contentContainerStyle={{ padding: space.md }}>
        <Text style={type.body}>{view.spokenText || "…"}</Text>
      </ScrollView>
      <Button label={view.finished ? "Done" : "Stop"} tone={view.finished ? "primary" : "ghost"} onPress={onExit} />
      <View style={{ height: space.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  box: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
});
