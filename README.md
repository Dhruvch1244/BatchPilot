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
│       ├── s3-explorer/        # S3 bucket browser (paginated list/upload/download)
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
see "Configuration" below if you need to change it). If 8743 is already taken by
something else on the machine, it automatically tries the next ports up (8744, 8745,
...) instead of failing to start, and writes whichever one it actually bound to
`~/.batchpilot/port.txt` — the packaged release's launcher scripts (see "Building a
shareable release" below) read that file so they still open the right URL. On first
run it also creates a data directory at `~/.batchpilot` (override with
`--batchpilot.data-dir=/custom/path`) containing:

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

### Automated releases (CI/CD)

Running `./release.sh` locally is still the way to build one manually, but
[`.github/workflows/release.yml`](.github/workflows/release.yml) does the same
thing automatically on every push to `main`:

1. Checks out the pushed commit and runs `release.sh` as-is (same script,
   same output — nothing release-specific is duplicated in the workflow).
2. Tags a version from the root `pom.xml`'s `<version>` (e.g. `1.0.0-SNAPSHOT`
   → `v1.0.0-<run number>`, so every run gets a unique, monotonically
   increasing tag without hand-maintaining a version file) and publishes a
   **GitHub Release** with `BatchPilot.zip` attached, plus auto-generated
   release notes from the commits since the last one.
3. Records that same release as a new entry at the top of
   [`RELEASES.md`](RELEASES.md) (linking straight to the download) and
   commits it back to `main`.

That commit's message ends in `[skip ci]` — GitHub's own convention for "don't
trigger any workflow for this push" — which is what stops step 3 from
triggering the workflow again on itself; no custom guard logic needed.
`workflow_dispatch` is also enabled, so a release can be kicked off by hand
from the Actions tab without waiting for the next push.

**Note:** the workflow pushes directly to `main` using the default
`GITHUB_TOKEN` (`permissions: contents: write`). If branch protection on
`main` requires PRs/reviews, that push will be rejected — either exempt
`github-actions[bot]` from the restriction, or this step will need to switch
to opening a small PR instead of pushing directly.

## Configuration

Backend settings live in `backend/src/main/resources/application.yml`:

| Property | Default | Description |
|---|---|---|
| `server.port` | `8743` | Backend HTTP port — deliberately not a common default (8080/8000/3000/...) to avoid colliding with other local apps. If it's already in use, `BatchPilotApplication` auto-picks the next free port instead of failing to start (see `resolvePort`/`writePortFile`) — this value is only what it *tries first* |
| `batchpilot.data-dir` | `${user.home}/.batchpilot` | Local JSON persistence directory |
| `batchpilot.default-username` | `hadoop` | Fixed SSH username for every environment |
| `spring.servlet.multipart.max-file-size` | `2GB` | Max single file upload size |

Application-level settings (theme, fonts, auto-reconnect, max tabs, upload
limits, ...) are editable from the Settings dialog in the UI and persisted to
`settings.json`. Defaults: 12px UI/terminal font size, 90% UI scale (see
below), 15 max terminal tabs, 2GB max upload size, auto-reconnect on.

The Settings modal (gear icon in the toolbar) is a left-nav **tabbed**
layout — **Appearance**, **Typography**, **Connection**, **Tabs & Uploads**,
**Data & History** — rather than one long scrolling page, so Appearance
(29 theme swatches) and Typography (fonts/sizes/scale) each get their own
focused screen instead of competing for space in a single cluttered
"Appearance" section. Appearance and Typography both show a **live preview**
panel (`shared/appearance-preview.component.ts` — a miniature mock of the
real toolbar/sidebar/card/button, styled by applying the exact same
`.theme-*` class the real app shell uses to a small scoped container) that
reflects the in-progress, not-yet-saved form values, so nothing has to be
committed blind before seeing it.

### UI scale

Settings → Typography → **UI scale** (default 90%) is an overall zoom applied
via CSS `zoom` on the document root (`--ui-scale` custom property, set from
`AppComponent`) — the same mechanism as a browser's own native zoom, chosen
specifically so viewport-relative layout (the app shell's own `100vh`/`100vw`
sizing) stays consistent instead of drifting from whatever gets scaled.
Denser than 100% by default for less scrolling on a typical
corporate-laptop-sized window; raise it back to 100%+ any time from Settings.

### First-run setup wizard

The first time BatchPilot is ever opened (no `settings.json` yet, so
`onboardingCompleted` defaults to `false`), a short setup wizard
(`onboarding/onboarding-wizard.component.ts`) walks through **Theme** →
**Typography** → **Defaults** → **Done**, each step live-previewed exactly
like the Settings modal (they share the same preview component and the same
theme/font catalogs, so the two never drift out of sync). **Skip setup** is
available at every step and still marks onboarding as seen, so it never
reappears uninvited — only "Get started" actually commits the wizard's
choices, skipping discards any in-progress draft. It's replayable any time
after from Settings → Data & History → "Replay the first-time setup wizard."

### Motion

Two shared easing curves in `styles.css` (`--ease-bounce`, a gentle
overshoot-and-settle spring; `--ease-spring`, a snappier no-overshoot one)
drive a small set of "premium app" touches: modals pop in with a soft
bounce, a newly-selected theme swatch does a quick scale pop, buttons/feature
cards lift with a spring on hover, and toasts bounce in from the bottom —
all disabled automatically under `prefers-reduced-motion: reduce`.

### Theme palette

Both the original light and dark themes are built around Fidelity Investments'
brand colors: deep green `#006044` (primary accent), secondary olive-green
`#76a923` (status/success family), and muted gold `#af8a49` (warnings) — tuned
per shade for contrast rather than used verbatim everywhere. See the CSS
custom properties under `.theme-light` / `.theme-dark` in
`frontend/src/styles.css` to adjust.

29 themes are selectable from Settings → Appearance in total: those two plus
27 more, including 22 modeled on real, popular neovim colorschemes (exact hex
values sourced from each project's own published palette) — Catppuccin
Mocha/Latte, Tokyo Night/Storm/Day, Gruvbox Dark/Light, Kanagawa, Rosé
Pine/Dawn, Everforest Dark/Light, Nightfox/Duskfox, Ayu Dark/Light, Material
Ocean, GitHub Dark/Light, SynthWave '84, Sonokai, and Solarized Dark (joining
the existing Solarized Light), alongside Dracula/Nord/One Dark/Monokai from an
earlier round. Each theme sets the same variable set as `.theme-light`/
`.theme-dark` — colors plus `--radius-*`/`--shadow-*`/`--letter-spacing-*`/
`--heading-weight` — so every component that only ever reads `var(--*)` themes
for free, but with a genuinely distinct *structural* personality per theme
rather than one uniform look recolored: Gruvbox and SynthWave '84 go sharp,
boxy, and hard-shadowed for an authentic "riced TUI" feel; Ayu and GitHub stay
flat and minimal; Catppuccin, Rosé Pine, and Kanagawa stay soft and rounded.
The terminal panel gets a matching hand-tuned ANSI 16-color palette per theme
too (`XTERM_THEMES` in `terminal-tab.component.ts`), so `ls` colors, prompts,
etc. read as part of the same theme rather than a generic default.

Settings → Typography adds independent UI font, terminal font, UI font size,
and UI line-height controls (`core/font-catalog.ts` for the curated font
lists) — including a few monospace UI font options (JetBrains Mono, Fira
Code, Iosevka, ...) for browsing the whole app chrome in a genuinely
terminal-native typeface, not just the terminal panel. Fonts are plain CSS
font-family stacks with fallbacks, not bundled webfont files, so a chosen
font renders only if it's actually installed on the machine BatchPilot is
opened on.

## Terminal & tabs

Every open panel — Terminal, Files, Applications, Stage Tracker, S3 Transfer,
S3 Explorer, any number of each, across any environment — lives in the same
tab strip (`tab-strip.component.ts`) under the toolbar. Tabs can be dragged
into any order: drag one by its title onto another to drop it there, with a
left-edge indicator line showing where it'll land. Purely a client-side
reorder (no persistence, same as which tab is currently active), so it resets
on reload rather than needing its own settings/storage plumbing.

The Terminal panel (`terminal-tab.component.ts`, built on xterm.js) supports
copy/paste beyond plain typing:

- **Plain Ctrl+V / Cmd+V** — the most reliable paste, since it's the browser's
  own native paste (xterm.js already listens for that event on its hidden
  input) rather than anything going through the async Clipboard API. Works
  everywhere, including a plain `http://` origin that isn't `localhost` -
  `navigator.clipboard` itself doesn't even exist in that case (it requires a
  "secure context": https, or localhost specifically), which is the realistic
  way this app gets reached day to day, over the internal network rather than
  behind TLS. Plain Ctrl+C is left completely alone - still SIGINT, exactly as
  before.
- **Ctrl+Insert / Shift+Insert** — the classic PuTTY/mintty/Windows-Terminal
  copy/paste bindings, and the most reliable *keyboard* shortcut on
  Windows/Linux specifically because they're not reserved by anything.
- **Ctrl+Shift+C / Ctrl+Shift+V** (or **Cmd+C / Cmd+V** on Mac) — also
  supported, but note Ctrl+Shift+C is the element-inspector shortcut in both
  Chrome and Firefox at the browser-chrome level, which a page can't
  override - it may open DevTools instead of copying depending on what else
  is bound to it in your browser. Ctrl+Insert doesn't have that problem.
- **Copy-on-select** — dragging out a selection copies it to the clipboard
  immediately, no extra keypress, the standard X11/Linux terminal convention.
- **Right-click** — copies the current selection if there is one, otherwise
  pastes the clipboard; the classic PuTTY/xterm right-click convention, and
  the fastest mouse-only path when you don't want to reach for the keyboard.

Every copy path falls back to the older `document.execCommand('copy')`
technique (an off-screen textarea, selected, then copied) whenever
`navigator.clipboard` isn't available for the reason above - unlike its
`'paste'` counterpart, browsers never locked that one down, so it still works
on any origin. There's no equivalent fallback for keyboard/right-click-*paste*
specifically (`execCommand('paste')` has been blocked in Chrome for years),
which is exactly why plain Ctrl+V/Cmd+V - not needing the Clipboard API at
all - is the one to reach for first if the others don't seem to be working.

Pasted text is queued through the same `ready`/pending-input buffer normal
typed keystrokes use, so pasting immediately after connecting (before the SSH
PTY channel is confirmed open) doesn't get silently dropped.

## YARN applications & the file stage tracker

Two toolbar actions expose Hadoop YARN (the resource manager, *not* the JS
package manager). By default every call runs a `yarn` CLI command over the
environment's existing SSH connection — there is no separate connection
mechanism, it's the same session Terminal/Quick Execute/File Manager already
share — but `YarnService` tries the ResourceManager's own REST API first
(`GET /ws/v1/cluster/apps`, `GET /ws/v1/cluster/nodes`, `PUT
/ws/v1/cluster/apps/{id}/state` to kill), which is the same JSON the RM's own
web UI (`http://<rm-host>:8088/cluster/apps`) loads from. No SSH round-trip,
no CLI cold-start, no text parsing — it's meaningfully faster when reachable.
The RM base URL is auto-derived from an environment's Server IP using AWS's
own internal-DNS convention (`ip-a-b-c-d.ec2.internal:8088`), the common case
when the RM lives on the same EC2 host the SSH session connects to; an
"Advanced" field in the environment form lets you override it explicitly
(different host, port, or scheme) when that doesn't hold. Either way it's
automatic and transparent: if the RM REST API isn't reachable, that call (and
every call for the next 2 minutes, so an unreachable RM doesn't add its
timeout to every single poll) falls straight back to the SSH `yarn` CLI path
with no user-visible difference beyond speed.

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
  Clicking a match opens that application's own page on the YARN Resource
  Manager (the same `trackingUrl` the RM reports for it) in a new tab — the
  deepest, most authoritative view of that specific run, one click away, no
  extra "view in RM" button needed. If the RM doesn't report a tracking URL
  for that application (it can age out of the RM's UI once old enough), the
  click falls back to opening the logs modal instead, so it still always goes
  somewhere. Logs also have their own dedicated icon per match, same as
  Applications, for opening logs specifically regardless of tracking-URL
  availability. A **Recent searches**
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
  folder like any other file). This, File Manager downloads, and S3 Explorer
  downloads all stream via Spring's `StreamingResponseBody`, which Spring MVC
  treats as an async request with its own ~30s timeout independent of any
  SSH/SFTP-level timeout — large enough files (or a slow enough connection)
  used to get silently cut off mid-transfer once 30s elapsed, with no
  `Content-Length` set (chunked encoding) for the client to detect the
  truncation. `spring.mvc.async.request-timeout` is set to 30 minutes in
  `application.yml` to fix this, matching the SSH-level timeout already used
  for large S3 transfers.
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

## S3 Explorer

The **S3 Explorer** toolbar action is a general-purpose file browser for an
S3 bucket — folders, objects, upload, download — separate from S3
Transfer's narrow "stage one file to a fixed `daaf-staging` path" flow.
Like every other S3/YARN feature in this app, it works by running `aws` CLI
commands over the environment's existing SSH session (`S3ExplorerService`)
rather than the backend talking to S3 directly: the EMR/edge node already
has working AWS credentials and, usually, a much better network path to S3
than wherever BatchPilot's backend happens to be running, so it's both
simpler and meaningfully faster to let that box do the work.

- **Listing** — `aws s3api list-objects-v2 --delimiter /` groups keys into
  "folders" (S3 CommonPrefixes) and "files" the same way the AWS Console
  does, rather than dumping a flat key list. Double-click a folder to
  navigate into it, **Up** to go back. A bucket can hold hundreds of
  thousands of keys, so listing is properly paginated server-side via
  `--max-items`/`--starting-token` (100 keys per page) — a **Load more**
  button appends the next page rather than the UI ever trying to hold or
  render an entire bucket at once.
- **Bucket** — defaults to the environment's `$S3_BUCKET` (left unexpanded,
  resolved by the *remote* shell, same rule S3 Transfer follows); type an
  explicit bucket name to browse anything else.
- **Download** — select one or more files and click **Download**. Each
  selected object is fetched with `aws s3 cp s3://bucket/key <remote temp
  file>`, then streamed back to the browser over the same SFTP session and
  the remote temp file cleaned up — no local AWS credentials or SDK, and
  nothing buffered in the backend's memory.
- **Upload** — drag-and-drop or the **Upload** button stage the local
  file(s) to a remote temp path over SFTP, then `aws s3 cp` moves it to
  `s3://bucket/<current prefix>/<file name>` and the temp file is removed.
- Every prefix, key, and continuation token is shell-quoted before it's
  interpolated into a remote command (S3 keys can contain almost anything
  printable, including spaces and unicode, so a character allowlist isn't
  an option here) — same command-injection discipline as every other
  SSH-exec feature in this app.

## Security notes

- PPK private key **contents are never transmitted, logged, or returned** by
  any API — only the filesystem path to the `.ppk` file is stored and used.
- The SSH username is fixed server-side (`hadoop` by default) and cannot be
  overridden from the client.
- CORS is restricted to `localhost` origins by default; adjust
  `AppConfig#corsConfigurer` for other deployment topologies.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper look at the
system design.
