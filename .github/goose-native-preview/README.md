# Native macOS review

This workflow builds and runs Goose Note on GitHub's standard public `macos-15` (Apple Silicon) runner. It does not change application source, use provider accounts, or require the owner's Mac. It runs for same-repository PRs targeting main, pushes to main, and manual dispatches. The recorder and application have separate exact SHAs in `manifest.json`: by default both check out the actual PR head or triggering workflow commit, without using the implicit PR merge revision. Manual dispatch can select an application branch, tag or full SHA through `app_ref`; the checkout resolves that ref once to a full SHA before initializing evidence. The manifest preserves the requested application ref and resolved SHA, and the post-build check requires that exact SHA and an unchanged lockfile.

## Gates

1. Install the frozen app dependencies and Electron runtime.
2. Before any full build, launch a tiny real Electron window with `chromiumSandbox: true`, `sandbox: true`, context isolation, and no Node integration. Retain macOS default security and do not request system permissions or weaken Electron sandboxing.
3. Only after that passes, run the repository's `bun run mac`. Typecheck stays on the local commit path and is not repeated here. Abort if the disposable runner already contains `/Applications/Goose Note.app`; never replace an existing app.
4. Launch the actual installed `.app`, show the first-run guide, choose light/ocean, open synthetic Markdown files through the app's real file-open path, edit and verify the saved file, view the real search preview, quit/reopen and verify persistence.
5. Preserve PNG checkpoints, native Electron renderer video, trace, logs, exact SHAs, lock hash, step results and per-file hashes. Failed stages remain failed, including launcher failures before an Electron handle exists.

The runtime uses the standard fresh GitHub macOS VM with a sanitized child environment, disposable profile, and synthetic Markdown files. Runtime external network is **not blocked at the OS level**, and the manifest says so explicitly. The scenario does not configure or use AI providers or synchronization. No Secrets or real notes are supplied. SIP, TCC, Gatekeeper and the firewall are left unchanged.

The first [lightweight preflight](https://github.com/eachann1024/goose-notes/actions/runs/36831809352) proved that an additional `sandbox-exec` wrapper could deny direct non-loopback sockets, but prevented Electron's own sandbox from initializing. That test remains failed with its original evidence. The standard runner execution below does not add that incompatible optional wrapper; it keeps Electron's native sandbox enabled.

The video records real Electron page frames, not the entire macOS desktop; it requires no system Screen Recording permission. The native file picker, global shortcuts, notarization and distribution signing are not covered. Prior full unit/lint failures are not resolved by these focused acceptance checks. No passing macOS result is claimed until the run and media have been inspected.

Capture dimensions come from the preflight's actual display work area and native window frame, capped at 1440×1000 and rounded down to even dimensions. The recorder resizes and positions the real `BrowserWindow`, without emulating a larger renderer viewport or changing the system display. It verifies native content size, renderer size, whole-window visibility and PNG dimensions against the video canvas. A smaller runner display therefore produces smaller complete images and video. The manifest preserves the display, scale factor, bounds and size checks for each launch/checkpoint. Each asserted checkpoint stays visible for 1.2 seconds for readability; this delay does not replace any readiness or persistence assertion. Raw video still includes the genuine application startup before the recorded geometry-ready timestamp.

Only synthetic notes and public source are used. Artifacts/logs are visible to repository readers and expire after seven days. No Pages deployment or release is performed. A durable user-facing delivery should preserve the raw evidence and save verified PNGs plus an H.264 playback copy through the recipient's authorized file destination.

The real runtime checks require macOS and should execute only within the workflow's sanitized runtime launcher, never as a web mock or an unsandboxed substitute. Previous artifacts retain their original application and recorder SHAs; they do not certify later revisions.
