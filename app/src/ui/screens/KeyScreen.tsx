/**
 * Step one of onboarding: the Anthropic key. Pasted, validated with a cheap
 * call, and handed up to be stored in the keystore. The copy is plain about who
 * gets billed, because the whole model is that the user pays Anthropic directly.
 */

import { useState } from "react";
import { Linking, StyleSheet, Text, TextInput, View } from "react-native";

import { Banner, Button, Screen } from "../components";
import { colors, radius, space, type } from "../theme";
import { validateAnthropicKey } from "../../onboarding/anthropic";

export interface KeyScreenProps {
  onValidated: (key: string) => void;
}

export function KeyScreen({ onValidated }: KeyScreenProps) {
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setChecking(true);
    setError(null);
    const result = await validateAnthropicKey(key.trim());
    setChecking(false);
    if (result.ok) onValidated(key.trim());
    else setError(result.detail);
  };

  return (
    <Screen>
      <Text style={type.display}>Your Anthropic key</Text>
      <Text style={type.dim}>
        The app talks to Claude with your own key. You're billed by Anthropic directly — a month of
        daily wraps is a few dollars. Nothing is stored on our side; there is no our side.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="sk-ant-…"
        placeholderTextColor={colors.textDim}
        value={key}
        onChangeText={setKey}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      {error ? <Banner tone="danger" text={error} /> : null}

      <Button label={checking ? "Checking…" : "Continue"} onPress={check} disabled={checking || !key.trim()} />
      <Button
        label="Get a key at console.anthropic.com"
        tone="ghost"
        onPress={() => void Linking.openURL("https://console.anthropic.com/settings/keys")}
      />
      <View style={{ flex: 1 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    ...type.body,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    marginTop: space.sm,
  },
});
