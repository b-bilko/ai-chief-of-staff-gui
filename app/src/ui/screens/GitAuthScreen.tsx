/**
 * Step two: connect GitHub with the OAuth device flow. The app shows a code,
 * the user approves it in a browser, and the app polls until the token arrives.
 * No personal access token to hand-build, no client secret in the app.
 */

import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { Banner, Button, Screen } from "../components";
import { colors, radius, space, type } from "../theme";
import type { DeviceCode, GitHubClient } from "../../onboarding/github";

export interface GitAuthScreenProps {
  client: GitHubClient;
  onToken: (token: string) => void;
}

export function GitAuthScreen({ client, onToken }: GitAuthScreenProps) {
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const connect = async () => {
    setError(null);
    try {
      const device = await client.startDeviceFlow();
      setCode(device);
      setWaiting(true);
      void Linking.openURL(device.verificationUri);
      const token = await client.pollForToken(device);
      onToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to GitHub.");
      setWaiting(false);
    }
  };

  return (
    <Screen>
      <Text style={type.display}>Connect GitHub</Text>
      <Text style={type.dim}>
        Your notes live in a private repository you own. Approve this app once and it can create or
        open that repo for you.
      </Text>

      {code ? (
        <View style={styles.codeBox}>
          <Text style={type.dim}>Enter this code at github.com:</Text>
          <Text style={styles.code}>{code.userCode}</Text>
          <Button
            label="Open GitHub"
            tone="ghost"
            onPress={() => void Linking.openURL(code.verificationUri)}
          />
        </View>
      ) : null}

      {error ? <Banner tone="danger" text={error} /> : null}

      <View style={{ flex: 1 }} />
      {!waiting ? (
        <Button label="Connect GitHub" onPress={connect} />
      ) : (
        <Text style={type.dim}>Waiting for you to approve in the browser…</Text>
      )}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginTop: space.md,
  },
  code: { fontSize: 34, fontWeight: "700", letterSpacing: 4, color: colors.accent, fontVariant: ["tabular-nums"] },
});
