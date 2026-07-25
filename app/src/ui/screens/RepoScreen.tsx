/**
 * Step three: choose the vault repo. Two first-class paths — create a fresh
 * private one from the template, or connect an existing private repo (for
 * anyone already running the system on desktop, or on a second device).
 *
 * The private-only gate lives in `prepareExistingRepo` / `prepareNewRepo`, so a
 * public repo simply throws here and never becomes a clone target.
 */

import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Banner, Button, Screen } from "../components";
import { colors, radius, space, type } from "../theme";
import type { GitHubClient, RepoSummary } from "../../onboarding/github";
import { prepareExistingRepo, prepareNewRepo, type CloneSpec } from "../../onboarding/repo";

export interface RepoScreenProps {
  client: GitHubClient;
  token: string;
  login: string;
  /** Called with the chosen repo's clone spec; the shell then clones it. */
  onChosen: (spec: CloneSpec) => void;
}

export function RepoScreen({ client, token, login, onChosen }: RepoScreenProps) {
  const [mode, setMode] = useState<"choose" | "create" | "connect">("choose");
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [newName, setNewName] = useState("my-chief-of-staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "connect" || repos) return;
    client
      .listPrivateRepos(token)
      .then(setRepos)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not list repos."));
  }, [mode, repos, client, token]);

  const guard = async (run: () => Promise<CloneSpec>) => {
    setBusy(true);
    setError(null);
    try {
      onChosen(await run());
    } catch (err) {
      // A RepoGateError lands here — a public or unwritable repo.
      setError(err instanceof Error ? err.message : "That repository can't be used.");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "create") {
    return (
      <Screen>
        <Text style={type.display}>New vault</Text>
        <Text style={type.dim}>A fresh private repository from the template, under your account.</Text>
        <TextInput style={styles.input} value={newName} onChangeText={setNewName} autoCapitalize="none" autoCorrect={false} />
        {error ? <Banner tone="danger" text={error} /> : null}
        <View style={{ flex: 1 }} />
        <Button
          label={busy ? "Creating…" : `Create ${login}/${newName}`}
          disabled={busy || !newName.trim()}
          onPress={() => void guard(() => prepareNewRepo(client, token, login, newName.trim()))}
        />
        <Button label="Back" tone="ghost" onPress={() => setMode("choose")} />
      </Screen>
    );
  }

  if (mode === "connect") {
    return (
      <Screen>
        <Text style={type.display}>Connect a vault</Text>
        <Text style={type.dim}>Pick a private repository you already use for this.</Text>
        {error ? <Banner tone="danger" text={error} /> : null}
        <ScrollView contentContainerStyle={{ gap: space.sm, paddingVertical: space.sm }}>
          {(repos ?? []).map((repo) => (
            <Button
              key={repo.fullName}
              label={repo.fullName}
              tone="ghost"
              onPress={() => void guard(() => prepareExistingRepo(client, token, repo.owner, repo.name))}
            />
          ))}
          {repos && repos.length === 0 ? <Text style={type.dim}>No private repos found.</Text> : null}
        </ScrollView>
        <Button label="Back" tone="ghost" onPress={() => setMode("choose")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={type.display}>Where should this live?</Text>
      <Text style={type.dim}>Your notes are a private record. They go in a private repo you own.</Text>
      <View style={{ flex: 1 }} />
      <Button label="Create a new vault" onPress={() => setMode("create")} />
      <Button label="Connect an existing one" tone="ghost" onPress={() => setMode("connect")} />
      <View style={{ height: space.lg }} />
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
