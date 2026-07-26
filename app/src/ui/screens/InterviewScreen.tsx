/**
 * The shared shape of an interview: the wrap and the first-run setup.
 *
 * Both are the same experience — a question spoken, an answer heard, a chance to
 * fix a mishearing before it is written down — so they share one screen. The
 * only difference a caller passes in is which flow to run and the copy around it.
 */

import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Banner, Button, Cost, PhaseIndicator, Screen } from "../components";
import { useFlow } from "../useFlow";
import { colors, radius, space, type } from "../theme";
import type { AgentEvent } from "../../agent/types";
import type { RunResult } from "../../agent/session";
import type { VoiceController } from "../../voice/turnTaking";

export interface InterviewScreenProps {
  title: string;
  intro: string;
  start: (onEvent: (event: AgentEvent) => void) => Promise<RunResult>;
  voice: VoiceController;
  onExit: () => void;
}

export function InterviewScreen({ title, intro, start, voice, onExit }: InterviewScreenProps) {
  const { view, running, begin, controls } = useFlow({ start, voice });
  const [edited, setEdited] = useState<string | null>(null);

  // Before starting: an intro and a big begin button.
  if (!running && view.phase === "idle") {
    return (
      <Screen>
        <Text style={type.display}>{title}</Text>
        <Text style={type.dim}>{intro}</Text>
        <View style={styles.spacer} />
        <Button label="Begin" onPress={begin} />
        <Button label="Not now" tone="ghost" onPress={onExit} />
      </Screen>
    );
  }

  // Finished: a short confirmation, then out.
  if (view.finished) {
    return (
      <Screen>
        <PhaseIndicator phase="done" />
        <Text style={type.body}>{view.spokenText || "Saved."}</Text>
        <View style={styles.footer}>
          <Cost usd={view.costUsd} />
          <Button label="Done" onPress={onExit} />
        </View>
      </Screen>
    );
  }

  const reviewing = view.phase === "reviewing";
  const transcriptValue = edited ?? view.transcript;

  return (
    <Screen>
      <View style={styles.header}>
        <PhaseIndicator phase={view.phase} />
        <Cost usd={view.costUsd} />
      </View>

      {view.error ? <Banner tone="danger" text={view.error} /> : null}

      {view.question ? (
        <View>
          <Text style={type.dim}>Question {view.questionNumber}</Text>
          <Text style={type.display}>{view.question}</Text>
        </View>
      ) : null}

      <ScrollView style={styles.transcriptBox} contentContainerStyle={{ padding: space.md }}>
        {reviewing ? (
          <TextInput
            style={[type.body, styles.input]}
            value={transcriptValue}
            onChangeText={(t) => {
              setEdited(t);
              controls.edit(t); // cancels the auto-confirm the moment they touch it
            }}
            multiline
            autoFocus
          />
        ) : (
          <Text style={[type.body, view.phase === "listening" && { color: colors.listening }]}>
            {view.transcript || (view.phase === "listening" ? "Listening…" : "")}
          </Text>
        )}
      </ScrollView>

      <View style={styles.controls}>
        {view.phase === "speaking" ? (
          <Button label="Skip, I'm ready" tone="ghost" onPress={controls.skip} />
        ) : null}
        {view.phase === "listening" ? (
          <Button label="Done answering" onPress={controls.stopListening} />
        ) : null}
        {reviewing ? (
          <Button
            label="Sounds right"
            onPress={() => {
              controls.confirm(edited ?? undefined);
              setEdited(null);
            }}
          />
        ) : null}
        <Button label="Cancel" tone="danger" onPress={() => { controls.cancel(); onExit(); }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  spacer: { flex: 1 },
  footer: { flex: 1, justifyContent: "flex-end", gap: space.md, paddingBottom: space.lg },
  transcriptBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { minHeight: 120, textAlignVertical: "top" },
  controls: { gap: space.sm, paddingBottom: space.lg },
});
