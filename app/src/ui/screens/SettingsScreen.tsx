/**
 * The config page, used in two places:
 *
 *  - **Before onboarding**, as the first screen: the user sets their Anthropic
 *    key and GitHub token here (by paste, or the GitHub device flow) before the
 *    guided repo step begins. No vault is bound yet, so the vault rows are
 *    hidden and the primary action is "Continue".
 *  - **After onboarding**, reached from Home: the same fields let a key be
 *    rotated or corrected without re-running setup, above read-only rows that
 *    keep the vault's private/public state and running cost in view.
 *
 * Each secret is masked, revealable, validated before it is saved, and persisted
 * to the device keystore — never into the vault.
 */

import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Banner, Button, Screen } from "../components";
import { colors, radius, space, type } from "../theme";
import { maskSecret } from "../../onboarding/secretStore";

export interface SettingsInfo {
  repoFullName: string;
  isPrivate: boolean;
  lastCommit: string | null;
  syncStatus: string;
  costThisMonthUsd: number;
  appVersion: string;
}

/** One editable secret the config page can set or rotate. */
export interface SecretFieldSpec {
  label: string;
  /** The current stored value, masked for display; null when nothing is set. */
  currentValue: string | null;
  placeholder: string;
  /** A "get one here" link, optional. */
  helpUrl?: string;
  /** An alternative to pasting, e.g. the GitHub device flow. */
  connect?: { label: string; onPress: () => void };
  /** Check a candidate value before it is saved. */
  validate: (value: string) => Promise<{ ok: boolean; detail?: string }>;
  /** Persist the validated value. */
  onSave: (value: string) => Promise<void>;
}

export interface SettingsScreenProps {
  title?: string;
  intro?: string;
  /** The vault rows; omitted before a vault is bound. */
  info?: SettingsInfo;
  secretFields: SecretFieldSpec[];
  /** The bottom action: "Continue" during setup, "Back" from Home. */
  primary: { label: string; onPress: () => void; disabled?: boolean; tone?: "primary" | "ghost" };
}

export function SettingsScreen({ title = "Settings", intro, info, secretFields, primary }: SettingsScreenProps) {
  return (
    <Screen>
      <Text style={type.title}>{title}</Text>
      {intro ? <Text style={type.dim}>{intro}</Text> : null}
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.xl }}>
        {info ? (
          <>
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
          </>
        ) : null}

        <Text style={[type.dim, { marginTop: info ? space.md : 0 }]}>KEYS &amp; CONNECTIONS</Text>
        {secretFields.map((field) => (
          <SecretRow key={field.label} field={field} />
        ))}

        <View style={styles.note}>
          <Text style={type.dim}>
            Keys are held only in this phone's keystore and never written into your repository. Your
            prompts go to Anthropic, billed to your key. Nothing goes to anyone else. Who you add as
            a collaborator, and whether this repo ever becomes public, is yours to manage.
          </Text>
        </View>
      </ScrollView>
      <Button label={primary.label} tone={primary.tone ?? "primary"} onPress={primary.onPress} disabled={primary.disabled ?? false} />
      <View style={{ height: space.lg }} />
    </Screen>
  );
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; detail: string }
  | { kind: "saved" };

function SecretRow({ field }: { field: SecretFieldSpec }) {
  const [editing, setEditing] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [value, setValue] = useState("");
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  const open = () => {
    setValue("");
    setReveal(false);
    setState({ kind: "idle" });
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setState({ kind: "idle" });
  };

  const save = async () => {
    const candidate = value.trim();
    if (!candidate) return;
    setState({ kind: "saving" });
    const result = await field.validate(candidate).catch(() => ({ ok: false, detail: "Couldn't check this value." }));
    if (!result.ok) {
      setState({ kind: "error", detail: result.detail ?? "That value was rejected." });
      return;
    }
    try {
      await field.onSave(candidate);
    } catch (err) {
      setState({ kind: "error", detail: err instanceof Error ? err.message : "Couldn't save." });
      return;
    }
    setState({ kind: "saved" });
    setEditing(false);
  };

  const masked = field.currentValue ? maskSecret(field.currentValue) : "";

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={type.dim}>{field.label}</Text>
        {!editing ? (
          <Text style={styles.change} onPress={open}>
            {field.currentValue ? "Change" : "Set"}
          </Text>
        ) : null}
      </View>

      {!editing ? (
        <>
          <Text style={[type.body, !field.currentValue && { color: colors.textDim }]}>
            {masked || "Not set"}
            {state.kind === "saved" ? "  ✓ updated" : ""}
          </Text>
          {field.connect ? (
            <View style={{ marginTop: space.sm }}>
              <Button label={field.connect.label} tone="ghost" onPress={field.connect.onPress} />
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ gap: space.sm }}>
          <TextInput
            style={styles.input}
            placeholder={field.placeholder}
            placeholderTextColor={colors.textDim}
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!reveal}
          />
          <View style={styles.actions}>
            <Text style={styles.toggle} onPress={() => setReveal((r) => !r)}>
              {reveal ? "Hide" : "Show"}
            </Text>
            {field.helpUrl ? (
              <Text style={styles.toggle} onPress={() => void Linking.openURL(field.helpUrl!)}>
                Get one
              </Text>
            ) : null}
            <View style={{ flex: 1 }} />
            <Text style={styles.toggle} onPress={cancel}>
              Cancel
            </Text>
            <Text
              style={[styles.toggle, styles.saveAction, (state.kind === "saving" || !value.trim()) && { opacity: 0.4 }]}
              onPress={state.kind === "saving" || !value.trim() ? undefined : () => void save()}
            >
              {state.kind === "saving" ? "Checking…" : "Save"}
            </Text>
          </View>
          {state.kind === "error" ? <Banner tone="danger" text={state.detail} /> : null}
        </View>
      )}
    </View>
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
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  change: { ...type.body, color: colors.accent, fontWeight: "600" },
  input: {
    ...type.body,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: space.lg },
  toggle: { ...type.body, color: colors.textDim, fontWeight: "600" },
  saveAction: { color: colors.accent },
  note: { paddingTop: space.sm },
});
