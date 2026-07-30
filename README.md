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
│       ├── model/             # Domain models (Environment, AppSettings, FileEntry, ...)
│       ├── repository/        # JSON file persistence (environments.json, settings.json)
│       ├── service/           # Business logic (CRUD, quick execute, file manager)
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
│       ├── settings/           # Settings modal
│       └── shared/             # Reusable modal component
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

Both files are loaded at startup and written through on every change — there is
no unsaved in-memory-only state.

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

## Security notes

- PPK private key **contents are never transmitted, logged, or returned** by
  any API — only the filesystem path to the `.ppk` file is stored and used.
- The SSH username is fixed server-side (`hadoop` by default) and cannot be
  overridden from the client.
- CORS is restricted to `localhost` origins by default; adjust
  `AppConfig#corsConfigurer` for other deployment topologies.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper look at the
system design.
