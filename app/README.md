# Chief of Staff — mobile app

A voice-first iOS and Android client for the [AI Chief of Staff](../README.md)
vault. It reads the evening wrap's questions aloud, transcribes your spoken
answers, and writes them into your own private markdown repo — so the daily loop
happens on the couch instead of at a terminal.

It is built to be self-hosted: you build it yourself, point it at your own
private vault repo, and run it with your own Anthropic key. There is no server,
no account, and nothing of yours passes through anyone else's infrastructure.

## What goes where

Be clear-eyed about this before you trust it with a record of your life:

- **Anthropic** receives your prompts — the wrap answers, the vault context the
  model reads — billed to **your** key. A month of daily wraps is a few dollars.
- **GitHub** receives your vault: plain markdown, pushed to a **private**
  repository you own. The app refuses to work with a public repo.
- **Your phone** does the speech. Transcription runs on-device; the audio never
  leaves the handset.
- **Nobody else** receives anything. No telemetry, no analytics, no backend.

The two secrets — your Anthropic key and your GitHub token — live in the device
keystore (iOS Keychain, Android Keystore) and are never written into the vault.

## Prerequisites

- **Node 20+** and npm.
- To run on **iOS**: a Mac with **Xcode** installed.
- To run on **Android**: **Android Studio** with an emulator or a connected device.
- No Xcode/Android Studio? Use an [**EAS build**](#build-without-a-mac) instead.

## Setup

```bash
cd app
npm install
```

### Register a GitHub OAuth app

The app signs you into GitHub with the **OAuth device flow**, which needs a
client id. This is public (device flow has no client secret), but each fork
should use its own:

1. GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. Any name and homepage URL. **Enable "Device Flow."**
3. Copy the **Client ID**.
4. `cp .env.example .env` and paste it as `EXPO_PUBLIC_GITHUB_CLIENT_ID`.

### Run it

The app relies on native modules (speech, secure storage), so it needs a dev
build rather than Expo Go. The first run compiles that build and installs it:

```bash
npx expo run:ios       # or: npx expo run:android
```

After that first build, `npm start` reloads JS changes without recompiling.

The first launch walks you through onboarding: your Anthropic key, GitHub
sign-in, and choosing a vault repo — either creating a fresh private one from the
template or connecting one you already use. From there it's the daily loop:
capture, the morning briefing, and the evening wrap.

You never need a terminal after building it. If you find yourself reaching for
one, that's a bug.

### Build without a Mac

To get the app onto a phone without Xcode or Android Studio, use Expo's cloud
builder:

```bash
npm install -g eas-cli
eas build --platform ios     # or android
```

This needs a free Expo account; for iOS it also needs an Apple Developer account
to install on a real device. See the [EAS Build docs](https://docs.expo.dev/build/introduction/).

## Develop

The vault, agent, and voice layers are plain TypeScript with no React and no
native dependency, so they run headlessly:

```bash
npm test          # ~190 tests on Node
npm run typecheck  # tsc, strict
```

Build and test those layers before touching UI — a full nine-question wrap can be
driven from a script with canned answers, which is a far better test surface than
tapping through a simulator. See [`AGENTS.md`](AGENTS.md) for the contract with
the vault (the timezone rule, verbatim answers, exact-path commits) that the code
has to honour.

## How it's built

The Claude Agent SDK can't run inside React Native, so the app talks to the
Claude **Messages API** directly and re-implements the small slice of harness the
skills need: skill markdown as the system prompt, file operations as tools, a
hand-written tool-use loop. **Git is the meeting point** — the same private repo
is edited by this app and, if you like, by a desktop Claude Code session.

```
src/vault/    fs facade + isomorphic-git over expo-file-system; timezone-correct
              dates; tracker/config parsers; private-repo and secret guards
src/agent/    the tool-use loop, the tool surface, and the wrap/capture/
              briefing/setup flows; the Anthropic client
src/voice/    the turn-taking state machine; expo-speech / -recognition edges
src/onboarding/  key validation, GitHub device flow, the private-only repo gate
src/core/     routing, the flow view-state reducer, the composition root
src/ui/       the screens and the shell
```

## Honest limitations

- **On-device transcription is worse than cloud.** It mishears names and jargon
  most — which is exactly the content the vault cares about. Every spoken answer
  is shown for you to fix before it's written, because a wrong transcript
  committed becomes a permanent, wrong quote. Keeping the audio on your phone is
  the trade, and it's the reason this is a private app and not a web service.
- **This is not on the App Store.** You build it and run it yourself. Sharing it
  is welcome; the BYO-key, self-build model is deliberate.
- **You pay Anthropic directly.** The app shows the running cost so there are no
  surprises.
- **Not yet hardware-tested.** The headless layers are thoroughly tested and the
  app bundles cleanly for iOS, but the native edges — the SDK under Hermes,
  on-device speech endpointing, keeping the audio session alive for a screen-off
  ten-minute wrap — need a real device to shake out. The iOS audio-session
  category is left as a marked TODO in `src/voice/expoRecognizer.ts` for exactly
  this reason.

## Security is yours to manage

The app enforces one thing: the vault repo must be private and writable, checked
before every clone. Past that, who you add as a collaborator, whether you later
flip the repo public, how your GitHub account is secured, and where your device
backups go are outside what the app can control. Settings keeps the repo's
private/public state visible so the fact stays in front of you.

## Credit

This is a client for [Derrek Young](https://derrekyoung.com)'s
[AI Chief of Staff](https://github.com/derrekyoung/ai-chief-of-staff) starter
kit, and it keeps that project's vault format and skills intact. MIT licensed,
like the kit it builds on.
