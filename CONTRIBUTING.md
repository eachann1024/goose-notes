# Contributing to goose-note

Thanks for your interest in contributing! This document explains how to get set
up and the conventions this project follows.

## Development setup

This project uses [Bun](https://bun.sh/) as the primary package manager and runtime.

```bash
# Install dependencies
bun install

# Start the dev server (http://localhost:6001)
bun run dev

# Build the uTools plugin bundle
bun run build
```

Node.js `>=20` is required if you run the toolchain without Bun.

## Before opening a pull request

Run the same checks CI runs, locally:

```bash
bun run typecheck   # tsc -b --noEmit
bun run lint        # eslint .
bun run build       # full production build
```

All three must pass. CI runs them on every pull request to `main` and `dev`.

## Branching & commits

- Branch off **`dev`**, not `main`. `main` always reflects the latest released state.
- Keep pull requests focused — one logical change per PR.
- Write commit messages in the [Conventional Commits](https://www.conventionalcommits.org/)
  style, e.g. `feat: add word-count footer`, `fix: prevent cursor jump on toggle`.
- Commit messages and PR descriptions should be in **English**.

## Code style

- TypeScript + React. ESLint config lives in `eslint.config.js`.
- Match the conventions of the surrounding code (naming, formatting, comment density).
- Avoid `any` where a real type is reasonable — `@typescript-eslint/no-explicit-any`
  is enabled as a warning.

## Reporting bugs & requesting features

Use the issue templates under **Issues → New issue**. Please include reproduction
steps, your environment (OS, uTools version or browser), and expected vs. actual
behavior.

## Security

Do not open public issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md).
