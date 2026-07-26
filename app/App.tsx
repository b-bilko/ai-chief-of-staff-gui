/**
 * The app shell.
 *
 * It holds the credentials and the current route, walks the onboarding sequence
 * in the order the routing resolver defines, and — once a key, a token, a bound
 * repo, and a configured vault all exist — assembles the services and lets the
 * user into the daily loop. The heavy lifting all lives in the tested layers
 * below; this is the wiring that turns them into screens.
 *
 * Native throughout (secure storage, files, network, speech), so this is
 * verified on a device rather than in the headless suite.
 */

import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";

import { GITHUB_CLIENT_ID } from "./src/core/config";
import { createServices, type Services, type VaultBinding } from "./src/core/services";
import {
  assessClonedVault,
  cloneVaultRepo,
  greetingFacts,
  loadBinding,
  saveBinding,
} from "./src/core/bootstrap";
import { colors } from "./src/ui/theme";
import { Screen } from "./src/ui/components";
import { HomeScreen } from "./src/ui/screens/HomeScreen";
import { InterviewScreen } from "./src/ui/screens/InterviewScreen";
import { BriefingScreen } from "./src/ui/screens/BriefingScreen";
import { CaptureScreen } from "./src/ui/screens/CaptureScreen";
import { SettingsScreen } from "./src/ui/screens/SettingsScreen";
import { GitAuthScreen } from "./src/ui/screens/GitAuthScreen";
import { RepoScreen } from "./src/ui/screens/RepoScreen";
import { createGitHubClient } from "./src/onboarding/github";
import { createExpoSecretStore } from "./src/onboarding/expoSecretStore";
import { SECRET_KEYS } from "./src/onboarding/secretStore";
import { validateAnthropicKey } from "./src/onboarding/anthropic";
import type { CloneSpec } from "./src/onboarding/repo";

type Route =
  | "loading"
  | "config"
  | "git"
  | "repo"
  | "cloning"
  | "not-a-vault"
  | "setup"
  | "home"
  | "wrap"
  | "briefing"
  | "capture"
  | "settings";

export default function App() {
  // SafeAreaView (in components.tsx) needs this provider above it.
  // initialMetrics gives synchronous first-frame insets, so the screen renders
  // immediately instead of staying blank until the async native measurement
  // arrives (which can otherwise leave a dark, empty frame on some devices).
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const secrets = useMemo(() => createExpoSecretStore(), []);
  const github = useMemo(() => createGitHubClient({ clientId: GITHUB_CLIENT_ID }), []);

  const [route, setRoute] = useState<Route>("loading");
  const [key, setKey] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [login, setLogin] = useState<string>("");
  const [binding, setBinding] = useState<VaultBinding | null>(null);
  const [services, setServices] = useState<Services | null>(null);
  const [greeting, setGreeting] = useState({ name: "there", weekday: "" });

  // Resume from wherever the user left off on a previous launch.
  useEffect(() => {
    void (async () => {
      const storedKey = await secrets.get(SECRET_KEYS.anthropicKey);
      const storedToken = await secrets.get(SECRET_KEYS.gitToken);
      const storedBinding = await loadBinding();
      setKey(storedKey);
      setToken(storedToken);
      setBinding(storedBinding);

      // Config comes first: the keys are set on one page (paste or device
      // flow) before the guided repo step begins.
      if (!storedKey || !storedToken) return setRoute("config");
      if (!storedBinding) return setRoute("repo");

      const readiness = await assessClonedVault();
      if (readiness.kind === "not-a-vault") return setRoute("not-a-vault");
      setRoute(readiness.kind === "ready" ? "home" : "setup");
    })();
  }, [secrets]);

  // Assemble services as soon as everything they need exists.
  useEffect(() => {
    if (key && token && binding && !services) {
      setServices(createServices({ anthropicKey: key, gitToken: token, binding, secrets }));
    }
  }, [key, token, binding, services, secrets]);

  // Freshen the greeting whenever we land on home.
  useEffect(() => {
    if (route === "home") void greetingFacts().then(setGreeting).catch(() => {});
  }, [route]);

  // --- onboarding step handlers ---

  // The GitHub device flow: on success, return to the config page so both keys
  // are visibly set before the user continues to the repo step.
  const onToken = async (t: string) => {
    await secrets.set(SECRET_KEYS.gitToken, t);
    setToken(t);
    setLogin(await github.getViewerLogin(t).catch(() => ""));
    setRoute("config");
  };

  const onRepoChosen = async (spec: CloneSpec) => {
    if (!token) return;
    setRoute("cloning");
    const bound = await cloneVaultRepo({ spec, token, login });
    await saveBinding(bound);
    setBinding(bound);
    const readiness = await assessClonedVault();
    setRoute(readiness.kind === "ready" ? "home" : readiness.kind === "not-a-vault" ? "not-a-vault" : "setup");
  };

  // --- config page: rotate a key without re-onboarding ---
  // Persist the new secret, update state, and rebuild services in place so the
  // change takes effect immediately (no Loading flash, no re-clone).

  const onUpdateAnthropicKey = async (value: string) => {
    await secrets.set(SECRET_KEYS.anthropicKey, value);
    setKey(value);
    if (token && binding) setServices(createServices({ anthropicKey: value, gitToken: token, binding, secrets }));
  };

  const onUpdateGitToken = async (value: string) => {
    await secrets.set(SECRET_KEYS.gitToken, value);
    setToken(value);
    // Resolve the login now: the clone step uses it for the git author line.
    setLogin(await github.getViewerLogin(value.trim()).catch(() => ""));
    if (key && binding) setServices(createServices({ anthropicKey: key, gitToken: value, binding, secrets }));
  };

  const validateAnthropic = async (value: string) => {
    const r = await validateAnthropicKey(value.trim());
    return r.ok ? { ok: true } : { ok: false, detail: r.detail };
  };

  const validateGitToken = async (value: string) => {
    const viewer = await github.getViewerLogin(value.trim()).catch(() => "");
    return viewer ? { ok: true } : { ok: false, detail: "GitHub rejected this token." };
  };

  // --- render ---

  if (route === "loading" || route === "cloning") return <Loading />;
  if (route === "config") {
    return withBar(
      <SettingsScreen
        title="Set up"
        intro="Add your keys to get started. You can change these any time in Settings."
        secretFields={[
          {
            label: "Anthropic API key",
            currentValue: key,
            placeholder: "sk-ant-…",
            helpUrl: "https://console.anthropic.com/settings/keys",
            validate: validateAnthropic,
            onSave: onUpdateAnthropicKey,
          },
          {
            label: "GitHub token",
            currentValue: token,
            placeholder: "ghp_… or a fine-grained token",
            connect: { label: "Connect with GitHub instead", onPress: () => setRoute("git") },
            validate: validateGitToken,
            onSave: onUpdateGitToken,
          },
        ]}
        primary={{ label: "Continue", onPress: () => setRoute("repo"), disabled: !(key && token) }}
      />,
    );
  }
  if (route === "git") return withBar(<GitAuthScreen client={github} onToken={(t) => void onToken(t)} />);
  if (route === "repo") {
    return withBar(<RepoScreen client={github} token={token ?? ""} login={login} onChosen={(s) => void onRepoChosen(s)} />);
  }

  // Everything past here needs services.
  if (!services) return <Loading />;

  switch (route) {
    case "setup":
      return withBar(
        <InterviewScreen
          title="Let's get set up"
          intro="A few questions so this sounds like you. Your name and timezone first."
          start={(onEvent) => services.setup(onEvent)}
          voice={services.voice}
          onExit={() => setRoute("home")}
        />,
      );
    case "wrap":
      return withBar(
        <InterviewScreen
          title="Wrap up the day"
          intro="Nine questions, in your words. It'll read them out; you talk."
          start={(onEvent) => services.wrap(onEvent)}
          voice={services.voice}
          onExit={() => setRoute("home")}
        />,
      );
    case "briefing":
      return withBar(<BriefingScreen start={(onEvent) => services.briefing(onEvent)} onExit={() => setRoute("home")} />);
    case "capture":
      return withBar(
        <CaptureScreen
          dictate={() => services.voice.askUser("")}
          start={(text, onEvent) => services.capture(text, onEvent)}
          onExit={() => setRoute("home")}
        />,
      );
    case "settings":
      return withBar(
        <SettingsScreen
          info={{
            repoFullName: binding ? repoNameFromUrl(binding.remoteUrl) : "—",
            isPrivate: true,
            lastCommit: null,
            syncStatus: "up to date",
            costThisMonthUsd: 0,
            appVersion: String(Constants.expoConfig?.extra?.appVersion ?? "dev"),
          }}
          secretFields={[
            {
              label: "Anthropic API key",
              currentValue: key,
              placeholder: "sk-ant-…",
              helpUrl: "https://console.anthropic.com/settings/keys",
              validate: validateAnthropic,
              onSave: onUpdateAnthropicKey,
            },
            {
              label: "GitHub token",
              currentValue: token,
              placeholder: "ghp_… or a fine-grained token",
              validate: validateGitToken,
              onSave: onUpdateGitToken,
            },
          ]}
          primary={{ label: "Back", tone: "ghost", onPress: () => setRoute("home") }}
        />,
      );
    default:
      return withBar(
        <HomeScreen
          name={greeting.name}
          weekday={greeting.weekday}
          onWrap={() => setRoute("wrap")}
          onBriefing={() => setRoute("briefing")}
          onCapture={() => setRoute("capture")}
          onSettings={() => setRoute("settings")}
        />,
      );
  }
}

function withBar(node: React.ReactElement): React.ReactElement {
  return (
    <>
      <StatusBar style="light" />
      {node}
    </>
  );
}

function Loading() {
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    </Screen>
  );
}

function repoNameFromUrl(url: string): string {
  return url.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
}
