/**
 * Capture: speak a thought, it gets filed. One voice turn gathers the thought
 * (reusing the same review-before-send safeguard), then the capture flow routes
 * it into today's note or the tracker and commits.
 */

import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Banner, Button, Cost, PhaseIndicator, Screen } from "../components";
import { useFlow } from "../useFlow";
import { space, type } from "../theme";
import type { AgentEvent } from "../../agent/types";
import type { RunResult } from "../../agent/session";

export interface CaptureScreenProps {
  /** Gather one spoken thought, reviewed, and return the confirmed text. */
  dictate: () => Promise<string>;
  /** Run the capture flow on the confirmed text. */
  start: (text: string, onEvent: (event: AgentEvent) => void) => Promise<RunResult>;
  onExit: () => void;
}

type Stage = "prompt" | "gathering" | "filing";

export function CaptureScreen({ dictate, start, onExit }: CaptureScreenProps) {
  const [stage, setStage] = useState<Stage>("prompt");
  const [text, setText] = useState("");
  const { view, running, begin } = useFlow({ start: (onEvent) => start(text, onEvent) });

  // Once the thought is gathered, file it (in an effect, not during render).
  useEffect(() => {
    if (stage === "filing" && !running && !view.finished && !view.error) begin();
  }, [stage, running, view.finished, view.error, begin]);

  const gather = () => {
    setStage("gathering");
    dictate()
      .then((spoken) => {
        setText(spoken);
        setStage("filing");
      })
      .catch(() => setStage("prompt"));
  };

  if (view.finished) {
    return (
      <Screen>
        <PhaseIndicator phase="done" />
        <Text style={type.body}>Filed: “{text}”</Text>
        <View style={{ flex: 1 }} />
        <Cost usd={view.costUsd} />
        <Button label="Done" onPress={onExit} />
      </Screen>
    );
  }

  if (stage === "filing") {
    return (
      <Screen>
        <PhaseIndicator phase={view.phase} />
        {view.error ? <Banner tone="danger" text={view.error} /> : null}
        <Text style={type.dim}>Filing your note…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={type.display}>Capture</Text>
      <Text style={type.dim}>Say the thought. You'll see it before it's saved.</Text>
      <View style={{ flex: 1 }} />
      <Button
        label={stage === "gathering" ? "Listening…" : "Hold the thought"}
        onPress={gather}
        disabled={stage === "gathering"}
      />
      <Button label="Back" tone="ghost" onPress={onExit} />
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
