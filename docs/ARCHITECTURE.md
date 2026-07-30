# BatchPilot Architecture

## Overview

BatchPilot is split into two deployables that talk over HTTP/WebSocket on a
single origin in production:

- **Backend** — Spring Boot 3 (Java 17), layered/service-based, owns all SSH
  state and local persistence.
- **Frontend** — Angular 17 (standalone components, signals) + TypeScript,
  a single-page app built with the Angular CLI's esbuild-based builder.

```
┌─────────────────────┐        REST (/api/**)        ┌──────────────────────────┐
│                      │ ────────────────────────────▶│                          │
│  Angular Frontend    │        WebSocket (/ws/**)     │   Spring Boot Backend    │
│   (xterm.js, SPA)    │ ◀────────────────────────────▶│                          │
└─────────────────────┘                                └───────────┬──────────────┘
                                                                     │ SSH / SFTP
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │  Remote environments  │
                                                          │  (DEV, UAT, custom)   │
                                                          └──────────────────────┘
```

## Backend layers

The backend follows a conventional layered architecture, kept intentionally
thin so each layer has one job:

1. **`controller`** — REST endpoints. Translate HTTP requests to service calls
   and back to DTOs. No business logic.
2. **`service`** — Business logic: environment CRUD/duplication rules, quick
   execute orchestration, file manager operations, YARN application
   list/status/kill/logs (`YarnService`), and file-to-pipeline-stage matching
   (`StageTrackerService`). Depends on the SSH layer and repositories, never
   on Spring MVC types.
3. **`ssh`** — Everything related to live SSH state:
   - `SshClientProvider` — one shared Apache MINA SSHD `SshClient` for the
     whole app (started once, stopped on shutdown).
   - `PpkKeyService` — parses PuTTY `.ppk` files from disk into `KeyPair`
     objects for authentication. Never persists or logs key material.
   - `SshConnectionManager` — owns a `ManagedConnection` per environment:
     connect/disconnect/reconnect, health checks (round-trip latency via a
     trivial `echo`), and automatic reconnection (governed by the
     `autoReconnect` / `reconnectIntervalSeconds` / `maxReconnectAttempts`
     settings) when a session drops unexpectedly.
4. **`repository`** — JSON file persistence for `Environment` and
   `AppSettings`. Loads at startup, writes through synchronously on every
   mutation (no unsaved in-memory-only state, no separate "save" action).
5. **`websocket`** — `TerminalWebSocketHandler` bridges one xterm.js tab (one
   WebSocket connection) to one interactive PTY shell channel on an
   already-connected environment's SSH session.
6. **`model` / `dto`** — Plain data types; DTOs are the only types that cross
   the REST boundary, keeping persistence models free of web concerns.
7. **`exception`** — A `@RestControllerAdvice` maps domain exceptions
   (`ResourceNotFoundException`, `SshOperationException`, validation errors)
   to structured JSON error responses with appropriate HTTP status codes.

## SSH connection lifecycle

`SshConnectionManager` keeps one `ManagedConnection` (session handle + state +
timestamps) per environment ID, independent of the persisted `Environment`
record:

1. **Connect** — loads the `.ppk` key via `PpkKeyService`, opens a session with
   Apache MINA SSHD, authenticates with the parsed key pair, and registers a
   `SessionListener` to detect unexpected drops.
2. **Disconnect** — a manual disconnect sets a flag so the listener does not
   treat the resulting `sessionClosed` event as a drop (no auto-reconnect
   triggered).
3. **Unexpected drop** — if `autoReconnect` is enabled in settings, a
   background scheduler retries the connection with the configured interval,
   up to `maxReconnectAttempts`, resetting on success.
4. **Reconnect** (manual) — disconnects then reconnects immediately.
5. **Health check** — for an already-connected session, runs a trivial
   `echo` over a fresh exec channel and reports round-trip latency.

Every other feature (terminal, quick execute, file manager) requires an
already-connected session and fetches it from `SshConnectionManager`, so
connection management is centralized in one place.

## Terminal streaming protocol

Each terminal tab opens its own WebSocket at `/ws/terminal/{environmentId}`
(carrying initial `cols`/`rows` as query parameters) and its own PTY shell
channel on the environment's shared SSH session. The wire protocol mixes:

- **Binary frames** — raw bytes in both directions (keystrokes in, PTY output
  out). xterm.js can write `Uint8Array` directly, so no decoding round-trip is
  needed on the frontend.
- **Text (JSON) frames** — small control messages: `{"type":"resize","cols":…,"rows":…}`
  from the client, and `{"type":"status"|"error", "message": …}` from the
  server.

Closing the tab closes its WebSocket, which closes its PTY channel — the
underlying SSH session for the environment stays open for other tabs.

## YARN integration & file stage tracker

`YarnService` runs a small, fixed set of `yarn` CLI commands
(`application -list`, `application -status`, `application -kill`, `logs`)
over the same SSH exec-channel mechanism `QuickExecuteService` uses — it
reuses `SshConnectionManager.getActiveSession`, so there is no separate
connection to YARN itself; the resource manager is just reachable from a
shell on the environment. Output parsing is hand-rolled (tab-separated for
`-list`, `key : value` lines for `-status`) since there's no JSON output mode
available on the CLI in general. Every `applicationId` path variable is
validated against YARN's own ID format before being interpolated into a
command string, since exec channels run through a remote shell.

`StageTrackerService` builds on top of `YarnService`: given a filename, it
lists all applications, filters to ones whose name contains the search term,
and classifies each into one of the five pipeline stages (Preprocessor,
Validation, Normalization, Daaf, Transmission) via
`PipelineStage.matchApplicationName` — a keyword-in-name heuristic, not a
lookup against the pipeline's actual status database (not wired up). Each
match is re-fetched via `-status` for accurate `Start-Time`/`Finish-Time`
(the `-list` output doesn't carry timestamps). Every search upserts into
`search-history.json` via `StageSearchHistoryRepository` (same
load-once/write-through pattern as `EnvironmentRepository`, keyed on
environment + filename so re-searching the same file refreshes one row
instead of appending a duplicate).

`YarnService` also exposes `yarn node -list -all`, `yarn queue -status`,
`yarn applicationattempt -list`, and `yarn container -list` for further EMR
cluster exploration beyond the core list/status/kill set; the latter two
return raw text rather than a parsed model, since attempt/container output
shape varies more across Hadoop versions than application list/status does.

### Log streaming

`YarnController#downloadLogs` never buffers a log in memory — `yarn logs`
output can run past 24 GB. The exec channel's stdout is wired directly to the
HTTP response's `OutputStream` (`StreamingResponseBody`, the same pattern
`FileManagerController#download` uses for SFTP downloads), with size-capping
(`tail -c <n>M`, applied remotely) and an optional grep filter both baked
into the command string before it runs — so filtering happens on the remote
host, not after gigabytes have already crossed the wire. The grep pattern is
shell-quoted (`'...'` with embedded-quote escaping) rather than validated
against an allowlist, since arbitrary search text is the whole point here;
the application ID feeding the rest of the command is still validated
against YARN's ID format first.

## S3 vendor-staging transfer

`S3TransferService` builds a fixed-shape `aws s3 cp
s3://$S3_BUCKET/daaf-staging/<vendor>/<fileName>.<type>.<YYYYMMDD>` command
and executes it by delegating to `QuickExecuteService` — no separate exec
path. `$S3_BUCKET` is left as a literal `$`-reference in the command string
so the *remote* shell expands it from whatever is configured in that
environment; this service never resolves it itself. Every piece that lands
in the command (vendor name, file name, file type, date, optional extra
arguments) is checked against a strict character allowlist first — same
reasoning as `YarnService`'s application-ID validation: this runs through a
real remote shell, so anything not validated is a command-injection vector.
`VendorRepository` persists vendor names to `vendors.json` (flat, deduped,
alphabetical) — a successful transfer auto-saves its vendor name, so there's
no separate "save vendor" action.

## File manager

`FileManagerService` opens a short-lived SFTP client (Apache MINA SSHD
`sshd-sftp`) on top of the environment's existing SSH session for each
operation (list/upload/download) and closes it immediately after. Upload
progress and multi-file selection are handled client-side (via
`XMLHttpRequest.upload.onprogress` and the browser's native multi-file
`<input>`/drag-and-drop), so the backend stays a stateless request/response
API for this feature.

## Persistence

Both `environments.json` and `settings.json` live under the configurable
`batchpilot.data-dir` (default `~/.batchpilot`), are loaded once at startup,
and are rewritten synchronously (guarded by a `ReentrantReadWriteLock`) on
every mutation — so there is no explicit "save" step and no risk of losing
in-memory changes on restart.

## Frontend structure

All components are standalone (no `NgModule`s); state is signal-based rather
than a service layered over RxJS `BehaviorSubject`s, so templates re-render
automatically on change with no manual subscription management.

**Tab-content sizing (`.tab-panel > *` in `styles.css`).** Each tab body
(`app-terminal-tab`, `app-file-manager-panel`, `app-applications-panel`, ...)
is a standalone component used directly as a flex child of `.tab-panel`.
Angular never gives a component's own host element a `display`/`flex` value
— only whatever's inside its template root gets that — so without an
explicit rule targeting the host, it defaults to `display: inline` /
`height: auto` and sizes to its *content* instead of the space actually
available. For most tabs that was just an invisible overflow; for the
terminal it was actively harmful: `FitAddon.fit()` measures the (wrongly
content-sized) host, resizes xterm's canvas to match, which grows the
content, which grows the auto-sized host again — an unbounded feedback loop
on every fit (tab switch, window resize, settings change). One global rule,
`.tab-panel > * { display: flex; flex-direction: column; flex: 1; min-height:
0; min-width: 0; }`, pins every tab-content component's host to the panel's
actual bounded size and fixes it for every tab type at once, present and
future — no per-component `:host` rule needed.

- **`core/models.ts`** — shared TypeScript types mirroring the backend DTOs.
- **`core/api.service.ts`** — thin `HttpClient` wrapper, one method per REST
  endpoint; file uploads use `HttpClient`'s native `reportProgress` events
  instead of a manual `XMLHttpRequest`.
- **`core/app-state.service.ts`** — single source of truth for environments,
  connection statuses (polled every 5s while connected/connecting), and
  settings, exposed as read-only signals (`environments`, `statuses`,
  `settings`, plus computed `selectedEnvironment`/`selectedStatus`). Exposes
  CRUD/connect/disconnect/reconnect actions used throughout the UI. Injected
  directly into whichever component needs it — no context provider wrapper
  required, since Angular's DI makes any `providedIn: 'root'` service a
  singleton reachable from anywhere in the tree.
- **`AppComponent`** (`app.component.ts`/`.html`) — the root shell: composes
  the toolbar, sidebar, tab strip, and status bar described in the
  requirements; owns open-tab state (`Tab[]`, each tab is either a `terminal`
  or `files` tab bound to one environment) and the settings/environment-form
  modal visibility.
- **`terminal/terminal-tab.component.ts`** — wraps one `xterm` (v4.6.0 —
  see the note on the unscoped package name below) instance plus its
  `FitAddon`/`WebLinksAddon` and WebSocket connection; reacts to
  font-size/theme changes via an Angular `effect()` calling `setOption()`
  (xterm 4.x has no writable `.options`, unlike 5.x) over the settings
  signal, and to tab activation via `ngOnChanges`.
- **`file-manager/`**, **`quick-execute/`**, **`applications/`**,
  **`stage-tracker/`**, **`s3-transfer/`**, **`settings/`**,
  **`environments/`** — one component per feature area, each talking to the
  backend through `ApiService` (or `AppStateService` where the action needs
  to update shared state).
- **`shared/icon.component.ts`** — a single `<app-icon name="...">` component
  rendering a small hand-maintained set of inline SVG (Lucide-style, 24x24,
  stroke-based) icons, used everywhere the UI previously used unicode glyphs
  (✎, ✕, 📁, ...). No icon font or external asset — every icon inherits
  `currentColor`, so it themes for free.
- **`shared/logs-modal.component.ts`** — shared between `applications/` and
  `stage-tracker/`: a live preview (last 500 lines, with Errors/Warnings
  presets or a custom grep filter, applied client-side against the preview
  text) plus a download link that points straight at the streaming
  size/grep-filtered backend endpoint — a plain `<a download>`, not a
  fetch-then-blob, so a multi-gigabyte download is never held in browser
  memory either.

## Visual design

The UI follows an Apple/shadcn-inspired language on top of the Fidelity
palette: low-contrast hairline borders (`rgba` over solid greys) instead of
heavy chrome, a wider corner-radius scale (`--radius-sm` through
`--radius-xl` in `styles.css`), soft multi-layer shadows for elevation
(toolbar/modals/panels), and consistent icon+label buttons. All of this lives
in CSS custom properties per theme (`.theme-light`/`.theme-dark`), so
component templates never hardcode colors, radii, or shadows directly.

## Non-functional considerations

- **Fast startup / low memory** — the backend starts a single shared SSH
  client and only opens per-environment sessions on demand; the frontend is a
  static SPA with no server-side rendering overhead.
- **Secure credential handling** — only `.ppk` file *paths* are ever stored or
  sent over the wire; key material is read from disk at connect time and held
  only as an in-memory `KeyPair`, never logged or returned by any endpoint.
- **Layered/service-based architecture** — see "Backend layers" above; each
  layer depends only on the layer(s) beneath it.
