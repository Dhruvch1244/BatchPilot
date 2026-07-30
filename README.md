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
  - Low-level utility packages that show up multiple times at different
    versions in the tree (e.g. `brace-expansion`, pulled in by `minimatch`
    at both `^1.1.7` and `^2.0.2` via different tools' internal glob
    matching) are worth consolidating to one `overrides` pin even before
    they've actually failed — one resolvable version everywhere instead of
    several is strictly safer against a corporate registry that's only
    mirrored one specific release.
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
