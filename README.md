# BatchPilot

BatchPilot is an SSH environment manager, terminal, and file-transfer console for
batch operations. It manages named environments (DEV, UAT, and any number of
custom targets), connects to them over SSH using PuTTY `.ppk` private keys, and
gives you a full browser-based terminal (xterm.js), a one-off "Quick Execute"
command runner, and an SFTP-backed file manager — all through a Spring Boot
backend and an Angular frontend.

## Project structure

```
batchpilot/
├── pom.xml                    # Maven parent (multi-module)
├── backend/                   # Spring Boot backend (Maven module)
│   ├── pom.xml
│   └── src/main/java/com/batchpilot/
│       ├── config/            # Spring configuration (CORS, WebSocket, properties)
│       ├── controller/        # REST controllers
│       ├── dto/                # Request/response payloads
│       ├── exception/         # Global error handling
│       ├── model/             # Domain models (Environment, AppSettings, FileEntry, YarnApplication, ...)
│       ├── repository/        # JSON file persistence (environments.json, settings.json, search-history.json)
│       ├── service/           # Business logic (CRUD, quick execute, file manager, YARN, stage tracker)
│       ├── ssh/               # SSH connection manager, PPK key loading
│       └── websocket/         # Terminal WebSocket <-> PTY bridge
├── frontend/                  # Angular 17 (standalone components) frontend
│   └── src/app/
│       ├── core/               # Shared TypeScript models, HttpClient API service, signal-based state store
│       ├── layout/             # Toolbar, Sidebar, StatusBar, root AppComponent shell
│       ├── environments/       # Environment list item + create/edit form modal
│       ├── terminal/           # Tab strip + xterm.js terminal component (WebSocket PTY bridge)
│       ├── quick-execute/      # Quick Execute side panel
│       ├── file-manager/       # File manager panel (browse/upload/download)
│       ├── applications/       # YARN running-applications view (list/sort/kill)
│       ├── stage-tracker/      # File pipeline stage tracker (search/kill/history)
│       ├── s3-transfer/        # S3 vendor-staging command builder/runner
│       ├── settings/           # Settings modal
│       └── shared/             # Reusable modal, icon, and logs-modal components
└── docs/
    └── ARCHITECTURE.md         # Architecture overview
```

## Prerequisites

- Java 17+
- Maven 3.9+
- Node.js `^18.13.0 || ^20.9.0` (Angular 17's officially supported range) and
  npm — **npm 11.10.0+ recommended** so the supply-chain cooldown in
  `frontend/.npmrc` (`min-release-age`) is actually enforced; on older npm
  it's silently ignored (no error, no protection). Check with `npm --version`.

## Build & run — backend

```bash
cd batchpilot
mvn clean package -pl backend -am
java -jar backend/target/batchpilot-backend.jar
```

The backend starts on **http://localhost:8080**. On first run it creates a data
directory at `~/.batchpilot` (override with `--batchpilot.data-dir=/custom/path`)
containing:

- `environments.json` — persisted environments (seeded with DEV and UAT presets)
- `settings.json` — persisted application settings
- `search-history.json` — past File Stage Tracker searches (see below)
- `vendors.json` — saved S3 vendor names (see "S3 vendor-staging transfer" below)

All four files are loaded at startup and written through on every change —
there is no unsaved in-memory-only state.

## Build & run — frontend

```bash
cd batchpilot/frontend
npm install
npm start
```

The dev server starts on **http://localhost:4200** and proxies `/api` and `/ws`
requests to the backend on port 8080 (see `proxy.conf.json`, wired up via
`angular.json`'s `serve.options.proxyConfig`). Start the backend first.

To build a production bundle:

```bash
npm run build
```

This produces static assets in `frontend/dist/frontend/`, which can be served
by any static file server or reverse-proxied alongside the backend.

### Troubleshooting `npm install`

- **`403 Forbidden` from a corporate npm registry/Artifactory on a specific
  package version** (e.g. `postcss@8.5.x`, `flatted@3.x`) — your org's
  registry hasn't mirrored/approved that version yet, usually because it's
  very recently published (the same "let brand-new packages age before
  trusting them" principle behind this project's own `min-release-age`
  policy, just enforced server-side on their end instead of client-side).
  Check `<your-registry>/<package-name>/` in a browser to see what your
  registry actually has cached under `versions` — its `dist-tags.latest`
  field is **not** reliable evidence that version is downloadable; it can
  point at a version the registry has metadata for but never actually
  mirrored the tarball of.
  - If the offending package is a **real dependency** (i.e. something the
    app actually needs, like `postcss`, pulled in by Angular's dev-server
    tooling), pin it via `overrides` in `package.json` to the exact version
    your registry has, then regenerate the lockfile (`rm -rf node_modules
    package-lock.json && npm install`). `postcss` is already pinned this
    way, to `8.4.21`.
  - If it's coming from tooling this project doesn't actually use, prefer
    removing that tooling outright instead of chasing its transitive
    dependencies one at a time. That's how `flatted@3.x` (via `log4js` via
    `karma`, Angular's default *unused* test runner — there are no `.spec.ts`
    files in this project) was resolved: `karma`/`karma-*`/`jasmine-core`/
    `@types/jasmine` were removed from `devDependencies`, along with the
    `test` target in `angular.json` and `tsconfig.spec.json`, eliminating
    the whole subtree rather than pinning `flatted` to whatever ancient
    version happened to be mirrored.
  - Don't pin a version speculatively "just in case" without confirming it's
    actually on your registry first (an earlier revision of this project did
    exactly that for `brace-expansion`, forcing a version that turned out not
    to exist there at all — an `ETARGET` error, not `403`, but the same root
    cause: guessing instead of checking `<your-registry>/<package-name>/`).
  - Even a version mismatch against a package's own stated peer/dependency
    range isn't automatically fatal. `enhanced-resolve` is a hard,
    non-optional dependency of `webpack`, itself a hard dependency of
    `@angular-devkit/build-angular` — `webpack` declares it needs
    `enhanced-resolve@^5.17.1`, but this project pins it to `4.5.0` via
    `overrides` anyway. That's safe here specifically because Angular 17's
    `application`/`dev-server` builders (what `ng build`/`ng serve` use in
    this project) are esbuild/Vite-based and never actually execute
    webpack's code paths — `webpack` and `enhanced-resolve` sit in
    `node_modules` unused. Verified end-to-end (`ng build`, `ng serve`, and
    a full SSH-backed session in both themes) with zero regressions before
    relying on this. Don't assume the same holds for every mismatched pin —
    check whether the code path that needs the "real" version is actually
    reachable in how you invoke the tool before trusting an override like
    this one.
- **xterm.js pinned to the old unscoped `xterm` package, not `@xterm/xterm`**
  — xterm.js renamed its npm scope starting at v5.0 (`xterm` →
  `@xterm/xterm`, `xterm-addon-*` → `@xterm/addon-*`); this project uses
  `xterm@4.6.0` with `xterm-addon-fit@0.5.0` and
  `xterm-addon-web-links@0.6.0` (the newest versions of each still
  peer-compatible with 4.x) because that's what's available on the
  registry this project was set up against. The two are **not**
  drop-in-compatible: 4.x has no writable `Terminal.options` (use
  `term.setOption(key, value)` instead), and the theme key is `selection`,
  not `selectionBackground`. If your registry does carry the `@xterm/*`
  scope, switching back is straightforward — swap the four package names
  in `package.json`/`angular.json`/`terminal-tab.component.ts` and reverse
  those two API differences.
- **`EPERM: operation not permitted, rmdir ...` warnings on Windows** during
  `npm install` — a file in `node_modules` is locked by another process
  (antivirus real-time scanning, an IDE, or OneDrive sync watching the
  folder). These are usually just noisy `npm warn cleanup` lines, not the
  actual failure; if `npm install` fails because of them, close any
  editors/terminals open in the project, exclude the folder from real-time
  antivirus scanning, and make sure the project isn't inside a OneDrive- or
  similar cloud-synced directory, then retry.

## Running both together

1. `mvn clean package -pl backend -am && java -jar backend/target/batchpilot-backend.jar`
2. In a second terminal: `cd frontend && npm install && npm start`
3. Open http://localhost:4200

## Configuration

Backend settings live in `backend/src/main/resources/application.yml`:

| Property | Default | Description |
|---|---|---|
| `server.port` | `8080` | Backend HTTP port |
| `batchpilot.data-dir` | `${user.home}/.batchpilot` | Local JSON persistence directory |
| `batchpilot.default-username` | `hadoop` | Fixed SSH username for every environment |
| `spring.servlet.multipart.max-file-size` | `2GB` | Max single file upload size |

Application-level settings (font size, theme, auto-reconnect, max tabs, upload
limits) are editable from the Settings dialog in the UI and persisted to
`settings.json`.

### Theme palette

Both the light and dark themes are built around Fidelity Investments' brand
colors: deep green `#006044` (primary accent), secondary olive-green `#76a923`
(status/success family), and muted gold `#af8a49` (warnings) — tuned per shade
for contrast rather than used verbatim everywhere. See the CSS custom
properties under `.theme-light` / `.theme-dark` in
`frontend/src/styles.css` to adjust.

## YARN applications & the file stage tracker

Two toolbar actions expose Hadoop YARN (the resource manager, *not* the JS
package manager) over the environment's existing SSH connection — there is no
separate connection mechanism, every call runs a `yarn` CLI command on the
same session Terminal/Quick Execute/File Manager already share:

- **Applications** — lists every YARN application (`yarn application -list
  -appStates ALL`) with state, progress, and a kill action
  (`yarn application -kill <id>`) for anything not yet finished. Auto-refreshes
  every 8 seconds. Sortable by state (in YARN's own lifecycle order —
  SUBMITTED → ACCEPTED → RUNNING → FINISHED → FAILED → KILLED), name, or user.
  Clicking a row (not the kill button) opens its logs.
- **Stage Tracker** — searches by filename and shows which YARN applications
  correspond to it, grouped into the five pipeline stages (Preprocessor,
  Validation, Normalization, Daaf, Transmission) with per-stage timing pulled
  from `yarn application -status` (`Start-Time`/`Finish-Time`) and a kill
  action per match. Clicking a match (by name or application ID — the
  filename is what you actually know going in, so that's what's foregrounded)
  opens its logs. A file can have multiple matches per stage (re-runs) —
  every match is shown, not collapsed into one. Every search upserts into
  `search-history.json` (searching the same filename again refreshes that one
  entry instead of piling up duplicates) and surfaces as a "Recent" dropdown
  capped at the 10 most recent unique filenames; picking one re-runs a fresh
  search rather than replaying stale state, since application status changes
  over time.
- **Logs** — from either view, opening an application's logs gets a live
  500-line preview (with one-click Errors/Warnings presets or a custom grep
  filter) and a **Download** button. Logs can run past 24 GB, so the download
  is never buffered in memory: pick how much to pull from the end (last
  500 MB/1/2/5 GB) and an optional grep filter, both applied *on the remote
  host* via `tail -c` / `grep` before anything crosses the wire, then streamed
  straight through to a normal browser download (lands in your Downloads
  folder like any other file).
- **More YARN commands** — `yarn node -list -all` (cluster node health/
  container counts), `yarn queue -status <queue>`, `yarn applicationattempt
  -list <appId>`, and `yarn container -list <attemptId>` are exposed as REST
  endpoints on `YarnController` (not all wired into a dedicated UI screen yet)
  for further exploration of an EMR cluster beyond the core list/status/kill
  set.

  **Stage classification is a v1 heuristic, not ground truth.** There is no
  connection wired up to the pipeline's own status database (a "Daaf DB")
  that would give an authoritative per-file stage — instead,
  `PipelineStage.matchApplicationName` (`backend/.../model/PipelineStage.java`)
  infers a stage from a keyword in the YARN application's *name*
  (`Preprocessor_<file>` → Preprocessor, etc.). Applications whose name
  doesn't contain a recognized keyword show up under "Other matches" rather
  than being silently dropped. Wiring this to a real status source instead of
  name-matching is the natural next step if/when that database is reachable
  from the backend.

  Every `applicationId` is validated against YARN's own ID format
  (`application_<timestamp>_<sequence>`) in `YarnService` before being
  interpolated into any shell command — exec channels run through a remote
  shell, so this guards against command injection via a crafted ID.

## S3 vendor-staging transfer

The **S3 Transfer** toolbar action builds and runs, over the environment's SSH
session:

```
aws s3 cp s3://$S3_BUCKET/daaf-staging/<vendor_name>/<fileName>.<file-type>.<YYYYMMDD>
```

`$S3_BUCKET` is left unexpanded on purpose — the *remote* shell resolves it
from whatever is set in that environment, this app never substitutes it.

- **Vendor** — a combo text input with autocomplete suggestions from
  previously-used vendors (`vendors.json`, same load/write-through pattern as
  the other JSON stores). A vendor is saved automatically the first time a
  transfer using it succeeds — no separate "save" step — and can be removed
  from the chip list underneath the input.
- **File name** — free text.
- **File type** — exactly `out`, `dif`, or `px`.
- **Date** — a date picker defaulting to today, formatted to `YYYYMMDD` for
  the command.
- **Extra arguments** — optional, for a destination path or extra flags the
  base template doesn't specify.

A live command preview shows exactly what will run before you click it. Every
field is validated against a strict character allowlist server-side
(`S3TransferService`) before being interpolated into the command string, for
the same reason YARN application IDs are — this also runs over a real remote
shell.

## Security notes

- PPK private key **contents are never transmitted, logged, or returned** by
  any API — only the filesystem path to the `.ppk` file is stored and used.
- The SSH username is fixed server-side (`hadoop` by default) and cannot be
  overridden from the client.
- CORS is restricted to `localhost` origins by default; adjust
  `AppConfig#corsConfigurer` for other deployment topologies.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper look at the
system design.
