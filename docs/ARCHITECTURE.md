# BatchPilot Architecture

## Overview

BatchPilot is split into two deployables that talk over HTTP/WebSocket on a
single origin in production:

- **Backend** — Spring Boot 3 (Java 17), layered/service-based, owns all SSH
  state and local persistence.
- **Frontend** — React 18 + TypeScript, a single-page app built with Vite.

```
┌─────────────────────┐        REST (/api/**)        ┌──────────────────────────┐
│                      │ ────────────────────────────▶│                          │
│   React Frontend     │        WebSocket (/ws/**)     │   Spring Boot Backend    │
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
   execute orchestration, file manager operations. Depends on the SSH layer
   and repositories, never on Spring MVC types.
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

- **`context/AppContext`** — single source of truth for environments,
  connection statuses (polled every 5s while connected/connecting), and
  settings; exposes CRUD/connect/disconnect/reconnect actions used throughout
  the UI.
- **`components/Layout`** — `AppShell` composes the toolbar, sidebar, tab
  strip, and status bar described in the requirements; it also owns open-tab
  state (`Tab[]`, each tab is either a `terminal` or `files` tab bound to one
  environment).
- **`components/Terminal`** — `TerminalTab` wraps one `@xterm/xterm` instance
  plus its `FitAddon`/`WebLinksAddon` and WebSocket connection.
- **`components/FileManager`**, **`components/QuickExecute`**,
  **`components/Settings`**, **`components/Environments`** — one panel per
  feature area, each talking to the backend through `api/client.ts`.

## Non-functional considerations

- **Fast startup / low memory** — the backend starts a single shared SSH
  client and only opens per-environment sessions on demand; the frontend is a
  static SPA with no server-side rendering overhead.
- **Secure credential handling** — only `.ppk` file *paths* are ever stored or
  sent over the wire; key material is read from disk at connect time and held
  only as an in-memory `KeyPair`, never logged or returned by any endpoint.
- **Layered/service-based architecture** — see "Backend layers" above; each
  layer depends only on the layer(s) beneath it.
