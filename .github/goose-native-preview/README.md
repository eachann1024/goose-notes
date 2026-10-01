# Native macOS review

This workflow builds and runs Goose Note on GitHub's standard public `macos-15` (Apple Silicon) runner. It does not change application source, use provider accounts, or require the owner's Mac. The recorder and application have separate exact SHAs in `manifest.json`: the application source is fixed to `fab53195d172c6ae008c8da9fe4d32716eba550a`; the recorder is the actual PR head.

## Gates

1. Install the frozen app dependencies and Electron runtime, run recorder unit tests.
2. Before any full build, launch a tiny real Electron window with `chromiumSandbox: true`, `sandbox: true`, context isolation, and no Node integration. Retain macOS default security and do not request system permissions or weaken Electron sandboxing.
3. Only after that passes, run the repository's `bun run mac` and `bun run typecheck`. Abort if the disposable runner already contains `/Applications/Goose Note.app`; never replace an existing app.
4. Launch the actual installed `.app`, show the first-run guide, choose light/ocean, open synthetic Markdown files through the app's real file-open path, edit and verify the saved file, view the real search preview, quit/reopen and verify persistence.
5. Preserve PNG checkpoints, native Electron renderer video, trace, logs, exact SHAs, lock hash, step results and per-file hashes. Failed stages remain failed, including launcher failures before an Electron handle exists.

The runtime uses the standard fresh GitHub macOS VM with a sanitized child environment, disposable profile, and synthetic Markdown files. Runtime external network is **not blocked at the OS level**, and the manifest says so explicitly. The scenario does not configure or use AI providers or synchronization. No Secrets or real notes are supplied. SIP, TCC, Gatekeeper and the firewall are left unchanged.

The first [lightweight preflight](https://github.com/eachann1024/goose-notes/actions/runs/36831809352) proved that an additional `sandbox-exec` wrapper could deny direct non-loopback sockets, but prevented Electron's own sandbox from initializing. That test remains failed with its original evidence. The standard runner execution below does not add that incompatible optional wrapper; it keeps Electron's native sandbox enabled.

The video records real Electron page frames, not the entire macOS desktop; it requires no system Screen Recording permission. The native file picker, global shortcuts, notarization and distribution signing are not covered. Prior full unit/lint failures are not resolved by these focused acceptance checks. No passing macOS result is claimed until the run and media have been inspected.

Only synthetic notes and public source are used. Artifacts/logs are visible to repository readers and expire after seven days. No Pages deployment or release is performed. A durable user-facing delivery should preserve the raw evidence and save verified PNGs plus an H.264 playback copy through the recipient's authorized file destination.

## Local checks

`node --test .github/goose-native-preview/record.test.mjs`

The real runtime checks require macOS and should execute only within the workflow's sanitized runtime launcher, never as a web mock or an unsandboxed substitute.
