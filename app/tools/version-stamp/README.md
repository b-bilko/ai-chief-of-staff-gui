# version-stamp

A small, **dependency-free, copy-paste** kit for versioning any project's builds.
Every build gets a version of the form `<base>+build.<n>` — e.g. `1.4.0+build.42`
— where the base is a human-owned SemVer number and `<n>` is an
auto-incrementing build number, so builds are always distinct and increasing.

Stack-agnostic: works for Node, Python, Go, Rust, or anything else. The only
runtime dependency is Node.js (preinstalled on GitHub Actions runners); the
scripts use **no npm packages**.

## What's in here

| File | Purpose |
|------|---------|
| `resolve-version.mjs` | Prints the full version (`base` + build number). Used by your build and CI. |
| `bump-version.mjs` | Bumps the base version (`major`/`minor`/`patch`). Used by the release workflow. |
| `templates/release.yml` | One-click release: bump base → commit → tag → GitHub Release. |
| `templates/publish.yml` | Resolve the version once and pass it into your build as `APP_VERSION`. |
| `templates/Dockerfile.snippet` | Thread `APP_VERSION` through Docker stages + OCI label. |
| `VERSION` | This repo's own base version (it dogfoods the kit). |

## Include it in a project

Vendor the scripts into `tools/version-stamp/` (the path the templates assume):

```bash
# degit — copies the files, no git history (recommended)
npx degit b-bilko/version-stamp tools/version-stamp

# …or a git submodule if you want to track upstream
git submodule add https://github.com/b-bilko/version-stamp tools/version-stamp

# …or just download/copy the files into tools/version-stamp/
```

Then:

1. **Pick a base-version source:**
   - Stack-agnostic (Python, Go, Rust, …): `echo 0.1.0 > VERSION` at the repo root.
   - Node project: nothing to do — `package.json`'s `version` is used automatically
     (and `bump-version.mjs` keeps it in sync if you also keep a `VERSION` file).
2. **Wire `APP_VERSION` into your build** (see below).
3. **Add the workflows** — copy `templates/release.yml` and the resolve step from
   `templates/publish.yml` into your project's `.github/workflows/`, adjusting the
   `main`/`master` branch references.

> Vendored to a different path? Update the `node tools/version-stamp/…` paths in
> the workflow templates to match.

## The version scheme

```
<base>              plain local/dev build            e.g. 1.4.0
<base>+build.<n>    release-cycle build number <n>   e.g. 1.4.0+build.42
```

- **base** — the release number you own. Read from the first of:
  `$VERSION_FILE` → `./VERSION` → `./package.json` "version" → `0.0.0`.
- **build number** — `$BUILD_NUMBER`, else `$GITHUB_RUN_NUMBER` (the GitHub
  Actions run number). Appended automatically; absent for a plain local build.
- **`$APP_VERSION`** — if set, used verbatim. CI resolves the version *once* and
  passes it downstream so every consumer reports the identical string.

## Wiring `APP_VERSION` into a build

**CI (any build):** resolve once, expose to everything downstream.

```yaml
- name: Resolve app version
  id: version
  run: echo "value=$(node tools/version-stamp/resolve-version.mjs)" >> "$GITHUB_OUTPUT"
```

**Docker:** pass it as a build arg (see `templates/publish.yml`) and thread it
through your stages (see `templates/Dockerfile.snippet`).

**Vite / frontend bundle:** bake it in as a compile-time constant.

```ts
// vite.config.ts
import { resolveVersion } from "./tools/version-stamp/resolve-version.mjs";
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(resolveVersion()) },
});
// and: declare const __APP_VERSION__: string;   // in a .d.ts
```

**Backend / runtime:** read the `APP_VERSION` env var the image was built with.

```python
import os
APP_VERSION = os.environ.get("APP_VERSION", "dev")   # Python
```
```go
version := os.Getenv("APP_VERSION")                  // Go
// …or inject at link time: -ldflags "-X main.version=$APP_VERSION"
```

Expose it somewhere observable (a `/health` or `/version` endpoint, a `--version`
flag, a footer) so you can confirm which build is live without guessing tags.

## Cutting a release

Run the **Release** workflow (*Actions → Release → Run workflow*) and choose
`patch` / `minor` / `major`. It bumps the base version, commits it, pushes a
`vX.Y.Z` tag, and cuts a GitHub Release. Point your publish workflow at
`tags: ["v*.*.*"]` to build the tagged release image.

Locally, the same bump is just:

```bash
node tools/version-stamp/bump-version.mjs minor   # writes VERSION (+ package.json)
```

## Notes & caveats

- **Base must be SemVer `X.Y.Z`.** `bump-version.mjs` refuses anything else.
- **`bump-version.mjs` rewrites `package.json`** with 2-space indentation when it
  syncs the version — check it matches your formatter, or drop the sync and keep
  `VERSION` as the sole source of truth.
- **The release workflow pushes to your default branch** with the built-in
  `GITHUB_TOKEN`. If that branch requires PRs (branch protection), use a
  PR-based release flow or a PAT instead.
- **`+build.<n>` is SemVer build metadata.** It's valid in a version string but
  **not** in a Docker *tag* — derive image tags from the git tag / SHA (as
  `templates/publish.yml` does), not from this string.

## License

MIT — see [LICENSE](LICENSE).
