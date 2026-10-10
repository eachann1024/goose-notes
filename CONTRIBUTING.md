# Goose Note contribution guide

Goose Note is licensed under the MIT License. Contributions must be compatible with that license and preserve third-party notices. Submit only work you own or are authorized to contribute, and identify imported code and its license. Contributing does not transfer your copyright. See [LICENSE](./LICENSE) and [THIRD-PARTY-NOTICES.txt](./THIRD-PARTY-NOTICES.txt).

## Development setup

This project uses [Bun](https://bun.sh/) as the primary package manager and runtime.

```bash
# Install dependencies
bun install

# Start the dev server (http://localhost:6001)
bun run dev

# Build the Electron desktop bundle
bun run build
```

Node.js `>=20` is required if you run the toolchain without Bun.

## Before opening a pull request

Use the relevant commands to diagnose syntax, type or packaging problems:

```bash
bun run typecheck   # tsc -b --noEmit
bun run lint        # eslint .
bun run build       # full production build
```

Product acceptance uses actual interaction: quickly exercise ordinary pages in the browser; have a `use-browser` subagent complete complex flows through the visible UI; use `use-compute` only for affected native controls and necessary system interactions. Build a macOS package only when the native change needs it. Record the actions, visible results and host behavior that the browser cannot verify.

Do not add or run TDD, ERE, unit or E2E cases, fixtures, test bridges, automated assertion/recording pipelines or coverage gates. Static diagnostics and successful compilation do not replace interaction acceptance. Resolve affected compilation failures before shipping.

## Branching & commits

- Branch off **`main`**. The repository currently uses `main` as its pull-request base.
- Keep pull requests focused — one logical change per PR.
- Write commit messages in the [Conventional Commits](https://www.conventionalcommits.org/)
  style, e.g. `feat: add word-count footer`, `fix: prevent cursor jump on toggle`.
- Commit messages and PR descriptions may use English or Simplified Chinese; keep each
  pull request internally consistent.

## Code style

- TypeScript + React. ESLint config lives in `eslint.config.js`.
- Match the conventions of the surrounding code (naming, formatting, comment density).
- Avoid `any` where a real type is reasonable — `@typescript-eslint/no-explicit-any`
  is enabled as a warning.

## Reporting bugs & requesting features

Use the project tracker and include
reproduction steps, the environment (OS, Electron version or browser), and
expected versus actual behavior.

## Maintainer review checklist

Use this when reviewing internal pull requests.

1. **Correct diff** — Review the PR’s real remote head (not a stale local branch with the same name).
2. **Acceptance** — Actual affected user paths, using the browser or native-control route above. Compilation commands are diagnostics, not a test gate.
3. **Scope** — One logical change; Conventional Commits; no `tasks/`, `.env*`, or AI-only tooling artifacts.
4. **Editor** — Changes under `src/components/editor/` must not break **title block one** (first block is always H1; see `src/components/editor/inputrules/firstTitleGuard.ts`).
5. **UI** — Preserve theme tokens, hover/selected states and sidebar rounded corners. Ordinary page changes use quick browser acceptance; native controls use the native route.
6. **Dual plugin** — Shared code must still build for both the main app and `GOOSE_BUILD_TARGET=quicknote` / `__GOOSE_LITE__`.
7. **Data** — Persistence and local-folder sync changes must not lose or silently overwrite notes.
8. **Security** — No hardcoded secrets or personal paths in defaults; see [SECURITY.md](./SECURITY.md).
9. **Verification** — Record actual interaction and unverified host boundaries. Do not infer CI results from local success.

Keep handwritten implementation files at or below 300 lines, grouped by responsibility. Main modules usually have 200–300 lines; entry points and focused helpers may be shorter. Split generated declarations through their generator, without mechanically splitting lockfiles or license data.

## Security

Do not open public issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md).
