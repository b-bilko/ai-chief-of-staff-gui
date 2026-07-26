/**
 * Settings, which is mostly a place to keep the user honest about where their
 * data lives. The repo's private/public state stays visible here, on purpose:
 * the app enforces private at setup, but the fact is worth keeping in front of
 * someone whose life record is in it.
 */

import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Screen } from "../components";
import { colors, radius, space, type } from "../theme";

export interface SettingsInfo {
  repoFullName: string;
  isPrivate: boolean;
  lastCommit: string | null;
  syncStatus: string;
  costThisMonthUsd: number;
  appVersion: string;
}

export interface SettingsScreenProps {
  info: SettingsInfo;
  onBack: () => void;
}

export function SettingsScreen({ info, onBack }: SettingsScreenProps) {
  return (
    <Screen>
      <Text style={type.title}>Settings</Text>
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.xl }}>
        <Row label="Vault repository" value={info.repoFullName} />
        <Row
          label="Visibility"
          value={info.isPrivate ? "Private" : "PUBLIC — this should not happen"}
          warn={!info.isPrivate}
        />
        <Row label="Last saved" value={info.lastCommit ?? "nothing yet"} />
        <Row label="Sync" value={info.syncStatus} />
        <Row label="Cost this month" value={`$${info.costThisMonthUsd.toFixed(2)}`} />
        <Row label="App version" value={info.appVersion} />

        <View style={styles.note}>
          <Text style={type.dim}>
            Everything you say is transcribed on this phone and written as plain markdown to your
            own private repository. Your prompts go to Anthropic, billed to your key. Nothing goes to
            anyone else. Who you add as a collaborator, and whether this repo ever becomes public, is
            yours to manage.
          </Text>
        </View>
      </ScrollView>
      <Button label="Back" tone="ghost" onPress={onBack} />
      <View style={{ height: space.lg }} />
    </Screen>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={type.dim}>{label}</Text>
      <Text style={[type.body, warn && { color: colors.danger }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  note: { paddingTop: space.sm },
});
