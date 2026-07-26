# Setting up an Android dev environment

The app is standard Expo, so building it for Android needs the standard Android
toolchain: a JDK, the Android SDK, and either an emulator or a physical phone.
This walks through it on **macOS** (Apple Silicon or Intel); Linux and Windows
differ mainly in install commands and paths, called out where they matter.

You do this once. After it's done, building the app is a single command
([Build and run the app](#5-build-and-run-the-app)).

> Versions here match Expo SDK 57 / React Native 0.86, which this app uses.
> **JDK 17** and **Android SDK Platform 36** are the load-bearing numbers — a
> different major JDK is the most common reason a build fails.

## What you'll install

| Piece | Why |
|---|---|
| **JDK 17** | Gradle (the Android build tool) runs on it. Not 21, not 11 — 17. |
| **Android Studio** | Ships the SDK Manager and the emulator, and the simplest way to get everything else. |
| **Android SDK Platform 36 + Build-Tools + Platform-Tools** | The APIs and tools the app compiles against, plus `adb`. |
| **An emulator system image, or a physical phone** | Something to run the app on. |

If you'd rather not install the full IDE, see
[the command-line-only path](#appendix-command-line-only) — but Android Studio
is the recommended route, especially for the emulator.

## 1. Install JDK 17

With [Homebrew](https://brew.sh), the `openjdk@17` **formula** installs into the
Homebrew prefix without asking for your password (the `zulu@17` cask works too
but installs a `.pkg` that needs `sudo`):

```bash
brew install openjdk@17
```

It's "keg-only" (not linked onto `PATH`), so point `JAVA_HOME` at it — Gradle
reads that. Add to `~/.zshrc`:

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
```

Confirm:

```bash
"$JAVA_HOME/bin/java" -version    # should print a 17.x version
```

> Linux: install `zulu17-jdk` (or `openjdk-17-jdk`) from your package manager.
> Windows: use the Zulu 17 MSI installer.

## 2. Install Android Studio and the SDK

1. Download and install [Android Studio](https://developer.android.com/studio).
2. Open it and run the **Setup Wizard** (Standard install). Accept the SDK
   license when prompted — the build can't download components until you do.
3. Open **Settings → Languages & Frameworks → Android SDK**. On the **SDK
   Platforms** tab, tick:
   - **Android SDK Platform 36** (listed under Android 16, "Baklava")
   - **Sources for Android 36**
4. On the **SDK Tools** tab, tick (check "Show Package Details" if you need a
   specific version):
   - **Android SDK Build-Tools**
   - **Android SDK Platform-Tools** (this is `adb`)
   - **Android SDK Command-line Tools (latest)**
   - **Android Emulator**
5. Apply. It downloads and installs. The SDK lands at
   `~/Library/Android/sdk` by default.

## 3. Set the environment variables

Add these to `~/.zshrc` (or `~/.bash_profile` for bash), then open a new
terminal or `source ~/.zshrc`:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/emulator"
# only needed for the command-line SDK tools (sdkmanager, avdmanager):
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin"
```

Verify:

```bash
adb --version          # Android Debug Bridge …
emulator -list-avds    # lists emulators (empty until you create one)
```

> Linux default SDK path is `~/Android/Sdk` (capital S). Windows uses
> `%LOCALAPPDATA%\Android\Sdk` and you set the vars via System Properties.

## 4. Get something to run the app on

### Option A — an emulator (no hardware needed)

1. In Android Studio, open **Device Manager** (the phone icon) → **Create
   Virtual Device**.
2. Pick a phone (e.g. Pixel 7), then a **system image**. On Apple Silicon choose
   an **arm64-v8a** image; pick one with **Google APIs / Google Play** so the
   on-device speech service is present — the wrap's voice input needs it.
3. Finish, then press ▶ to boot it. Leave it running.

### Option B — a physical phone (better for testing voice)

1. On the phone: **Settings → About phone**, tap **Build number** seven times to
   unlock Developer options.
2. **Settings → Developer options → USB debugging** on. Plug it into the Mac.
3. Confirm the "Allow USB debugging?" prompt on the phone, then:

   ```bash
   adb devices    # your phone should be listed as "device"
   ```

A real phone is the honest test for the voice layer — emulator microphones and
speech recognition are unreliable.

## 5. Build and run the app

From the `app/` directory, with the emulator running or the phone plugged in:

```bash
cd app
npm install
cp .env.example .env     # then set EXPO_PUBLIC_GITHUB_CLIENT_ID (see README)
npx expo run:android
```

The first build is slow — Gradle downloads dependencies and compiles the native
project (Expo generates `android/` for you; it's gitignored and regenerated as
needed). After that first build, `npm start` reloads JS changes without
recompiling.

## Troubleshooting

- **"Unable to locate a Java Runtime" / wrong Java version.** `java -version`
  isn't 17. Install Zulu 17 and set `JAVA_HOME` (step 1). This is the single most
  common failure.
- **"SDK location not found" / `ANDROID_HOME` errors.** The env vars from step 3
  aren't in the current shell. Open a new terminal or `source ~/.zshrc`, and
  check `echo $ANDROID_HOME`.
- **License errors during the build.** Accept them from the command line:
  ```bash
  sdkmanager --licenses     # needs cmdline-tools on PATH (step 3)
  ```
- **`adb: command not found`.** `platform-tools` isn't on PATH (step 3), or
  Platform-Tools isn't installed (step 2, SDK Tools tab).
- **Emulator won't boot or is very slow.** Make sure you picked an **arm64**
  image on Apple Silicon (an x86 image emulates slowly or not at all), and give
  it a few minutes on first boot.
- **Voice input does nothing in the emulator.** Use a system image with **Google
  APIs/Play**, or test on a physical phone — on-device recognition needs
  Google's speech service.

## Appendix: command-line only

If you don't want the full IDE, install just the command-line tools and drive
the SDK from the terminal. After installing JDK 17 (step 1):

```bash
brew install --cask android-commandlinetools
# the cask's SDK root (where sdkmanager installs everything):
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"

# install the components the app needs (yes | auto-accepts the licenses)
yes | sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" "platforms;android-36" "build-tools;36.0.0" "emulator"

# an arm64 emulator image with Google APIs (base android-36 has no arm64 phone
# image; 36.1 does). Google APIs/Play carries the on-device speech service.
yes | sdkmanager --sdk_root="$ANDROID_HOME" "system-images;android-36.1;google_apis;arm64-v8a"
echo "no" | avdmanager create avd -n cos -k "system-images;android-36.1;google_apis;arm64-v8a" -d pixel_7
emulator -avd cos &
```

Then build with `npx expo run:android` as in [step 5](#5-build-and-run-the-app).
The `sdkmanager`/`avdmanager` binaries are symlinked onto `PATH` by the cask, so
you can call them directly.
