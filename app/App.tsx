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
import { StatusBar } from "expo-status-bar";

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
import { KeyScreen } from "./src/ui/screens/KeyScreen";
import { GitAuthScreen } from "./src/ui/screens/GitAuthScreen";
import { RepoScreen } from "./src/ui/screens/RepoScreen";
import { createGitHubClient } from "./src/onboarding/github";
import { createExpoSecretStore } from "./src/onboarding/expoSecretStore";
import { SECRET_KEYS } from "./src/onboarding/secretStore";
import type { CloneSpec } from "./src/onboarding/repo";

type Route =
  | "loading"
  | "key"
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

      if (!storedKey) return setRoute("key");
      if (!storedToken) return setRoute("git");
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

  const onKey = async (k: string) => {
    await secrets.set(SECRET_KEYS.anthropicKey, k);
    setKey(k);
    setRoute("git");
  };

  const onToken = async (t: string) => {
    await secrets.set(SECRET_KEYS.gitToken, t);
    setToken(t);
    setLogin(await github.getViewerLogin(t).catch(() => ""));
    setRoute("repo");
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

  // --- render ---

  if (route === "loading" || route === "cloning") return <Loading />;
  if (route === "key") return withBar(<KeyScreen onValidated={(k) => void onKey(k)} />);
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
          }}
          onBack={() => setRoute("home")}
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
