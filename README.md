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
├── packaging/                  # Release launcher scripts (copied verbatim by release.sh)
│   ├── windows/                # BatchPilot.bat, BatchPilot-Silent.vbs, Stop-BatchPilot.bat
│   ├── unix/                   # run.sh
│   └── README.txt              # Instructions bundled into the release zip
├── release.sh                  # One-command build: prod frontend + backend -> release/BatchPilot.zip
└── docs/
    └── ARCHITECTURE.md         # Architecture overview
```

- **The dev/quotidian workflow** (frontend `npm start` on 4200 proxying to backend
  on 8743) is unchanged — see "Build & run" below.
- **To hand BatchPilot to someone else**, run `./release.sh` — see "Building a
  shareable release" below.

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

The backend starts on **http://localhost:8743** (a deliberately uncommon port —
see "Configuration" below if you need to change it). On first run it creates a data
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
requests to the backend on port 8743 (see `proxy.conf.json`, wired up via
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

## Building a shareable release

The dev setup above (two processes, two ports) is for working on BatchPilot.
To hand a working copy to someone else, build a **release** instead — one
self-contained jar that serves both the UI and the API on a single port
(`8743`), so the person running it doesn't need Node/npm/Maven, doesn't need
to run two things, and doesn't need to know anything about how the app is
built:

```bash
./release.sh
```

This builds the Angular frontend for production, embeds the compiled output
directly into the backend's static resources
(`backend/src/main/resources/static/` — gitignored, regenerated by the
script every run), builds the executable backend jar with that frontend
baked in, and assembles everything into `release/` plus a single
`BatchPilot.zip` — that zip is the one file to hand someone.

Inside the release folder:

| File | Purpose |
|---|---|
| `BatchPilot.jar` | The whole app — UI + API — as one executable jar |
| `BatchPilot.bat` | Windows: double-click to start (opens the browser automatically; closing the console window stops it) |
| `BatchPilot-Silent.vbs` | Windows: same, but with no visible window (needs `Stop-BatchPilot.bat` to stop it later, and won't run on machines where corporate policy disables VBScript) |
| `Stop-BatchPilot.bat` | Windows: stops an instance started with the silent `.vbs` launcher |
| `run.sh` | macOS/Linux: `./run.sh` — starts it and opens the browser; Ctrl+C to stop |
| `README.txt` | Plain-text instructions for whoever you send the zip to |

The only requirement on the receiving end is Java 17+, which is already
present on most corporate/work machines — there's nothing else to install.
The launcher scripts (`packaging/windows/`, `packaging/unix/`) are checked
into source control and copied verbatim by `release.sh`; edit them there,
not in a generated `release/` folder.

## Configuration

Backend settings live in `backend/src/main/resources/application.yml`:

| Property | Default | Description |
|---|---|---|
| `server.port` | `8743` | Backend HTTP port — deliberately not a common default (8080/8000/3000/...) to avoid colliding with other local apps |
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
  -appStates ALL`), grouped into **Running** (always shown, never collapsed),
  **Finished**, **Failed**, and **Killed** sections (the last three
  collapsible, with counts) so a cluster with hundreds of historical
  applications doesn't bury the ones that are actually running right now.
  Each section is paginated (20 per page) rather than rendering everything at
  once. Defaults to newest-first — sorted by the sequence number embedded in
  the application ID (`application_<clusterTimestamp>_<sequence>`) rather
  than an extra `-status` call per application, since `-list` doesn't return
  timestamps at all; also sortable by name or user. Auto-refreshes every 8
  seconds. The kill button only appears on applications actually in a
  killable state (not just disabled on the rest) — nothing to click on a
  FINISHED/FAILED/KILLED row. A dedicated logs icon opens that application's
  logs; clicking the row itself instead extracts the file name from the
  application name (see below) and jumps to **Stage Tracker** pre-searched
  for that exact file.
- **Stage Tracker** — searches by filename and shows which YARN applications
  correspond to it. Application names follow
  `<Stage>_<fileName>_<YYYYMMDD>` (the date suffix is optional); a broad
  search term can match applications belonging to *different* underlying
  files (searching "2026_07" might hit both `report_2026_07.csv` and
  `sales_2026_07.xlsx`), so results are grouped one card per distinct file,
  not lumped into one. Each file's pipeline only shows the stages it actually
  has activity in — **Preprocessor, Validation, Normalization, Delta,
  Transmission, Outbound** are all recognized, but nothing forces a fixed
  count of stages per file (Outbound in particular is conditional, only some
  files go through it) — ordered by each stage's earliest observed start
  time rather than a hardcoded sequence, i.e. the actual flow for that file.
  Each card also shows the most recent completion time across its matches.
  Clicking a match narrows the search down to just that file (useful after a
  broad search matched several) rather than opening logs — logs have their
  own dedicated icon per match, same as Applications. A **Recent searches**
  sidebar on the left (not a dropdown) keeps the last 10 unique filenames
  searched, persisted server-side so they survive a reconnect/reload — you
  don't have to retype a filename you already searched. Every search upserts
  into `search-history.json` (searching the same filename again refreshes
  that entry instead of piling up duplicates). Per-application `-status`
  calls (needed for accurate start/finish times, since `-list` doesn't carry
  them) run concurrently rather than one-at-a-time — with more than a couple
  of matches, sequential round-trips were the dominant cost of a search.
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
  connection wired up to the pipeline's own status database that would give
  an authoritative per-file stage — instead, `PipelineStage.extract`
  (`backend/.../model/PipelineStage.java`) infers both the stage and the file
  identity purely from the YARN application's *name*
  (`Preprocessor_<file>_<date>` → stage `PREPROCESSOR`, file `<file>`).
  Applications whose name doesn't start with a recognized stage keyword still
  show up under "Other matches" rather than being silently dropped. Wiring
  this to a real status source instead of name-matching is the natural next
  step if/when that database is reachable from the backend.

  Every `applicationId` is validated against YARN's own ID format
  (`application_<timestamp>_<sequence>`) in `YarnService` before being
  interpolated into any shell command — exec channels run through a remote
  shell, so this guards against command injection via a crafted ID.

## S3 vendor-staging transfer

The **S3 Transfer** toolbar action builds and runs, over the environment's SSH
session:

```
aws s3 cp <source file> s3://$S3_BUCKET/daaf-staging/<vendor_name>/<fileName>.<file-type>.<YYYYMMDD>
```

`$S3_BUCKET` is left unexpanded on purpose — the *remote* shell resolves it
from whatever is set in that environment, this app never substitutes it.

- **Source file** — either a path already on the environment (e.g. an EMR
  box path, typed directly), or a local file attached from your computer
  (any kind) — attaching one uploads it to the environment first (over the
  same SFTP upload the File Manager uses, to a directory you choose,
  `.` — the home directory — by default) and then uses that uploaded path as
  the `aws s3 cp` source.
- **Vendor** — a combo text input with autocomplete suggestions from
  previously-used vendors (`vendors.json`, same load/write-through pattern as
  the other JSON stores). A vendor is saved automatically the first time a
  transfer using it succeeds — no separate "save" step — and can be removed
  from the chip list underneath the input.
- **Staged file name** — free text; this is the *destination* file name in
  the `daaf-staging` path, independent of whatever the source file is
  actually called.
- **File type** — exactly `out`, `dif`, or `px`.
- **Date** — a date picker defaulting to today, formatted to `YYYYMMDD` for
  the command.
- **Extra `aws cp` flags** — optional (e.g. `--sse AES256`), appended after
  the destination.

A live command preview shows exactly what will run before you click it. The
vendor/file-name/file-type/date fields are validated against a strict
character allowlist server-side (`S3TransferService`); the source path is
shell-quoted instead (it has to accept arbitrary uploaded file names) — both
for the same reason YARN application IDs are validated: this runs over a
real remote shell, so anything not handled is a command-injection vector.

## Security notes

- PPK private key **contents are never transmitted, logged, or returned** by
  any API — only the filesystem path to the `.ppk` file is stored and used.
- The SSH username is fixed server-side (`hadoop` by default) and cannot be
  overridden from the client.
- CORS is restricted to `localhost` origins by default; adjust
  `AppConfig#corsConfigurer` for other deployment topologies.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper look at the
system design.
