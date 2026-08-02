export type EnvironmentType = 'DEV' | 'UAT' | 'CUSTOM';

export interface Environment {
  id: string;
  name: string;
  type: EnvironmentType;
  serverIp: string;
  sshPort: number;
  ppkPath: string;
  username: string;
  /** Optional override for the YARN ResourceManager's base URL, used to fetch applications
   * directly via its REST API instead of the slower SSH `yarn` CLI path. Blank means
   * auto-derive from serverIp (ip-a-b-c-d.ec2.internal:8088). */
  yarnRmUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentRequest {
  name: string;
  type: EnvironmentType;
  serverIp: string;
  sshPort: number;
  ppkPath: string;
  yarnRmUrl?: string;
}

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface ConnectionStatus {
  environmentId: string;
  state: ConnectionState;
  message?: string | null;
  latencyMs?: number | null;
  connectedSince?: number | null;
}

export type AppTheme =
  | 'dark'
  | 'light'
  | 'dracula'
  | 'nord'
  | 'solarized-light'
  | 'one-dark'
  | 'monokai'
  // ---- Neovim-inspired themes ----
  | 'catppuccin-mocha'
  | 'catppuccin-latte'
  | 'tokyonight'
  | 'tokyonight-storm'
  | 'tokyonight-day'
  | 'gruvbox-dark'
  | 'gruvbox-light'
  | 'kanagawa'
  | 'rose-pine'
  | 'rose-pine-dawn'
  | 'everforest-dark'
  | 'everforest-light'
  | 'nightfox'
  | 'duskfox'
  | 'ayu-dark'
  | 'ayu-light'
  | 'material-ocean'
  | 'github-dark'
  | 'github-light'
  | 'synthwave84'
  | 'sonokai'
  | 'solarized-dark';

export interface AppSettings {
  /** Terminal (xterm.js) font size in px. */
  fontSize: number;
  theme: AppTheme;
  autoReconnect: boolean;
  reconnectIntervalSeconds: number;
  maxReconnectAttempts: number;
  maxTabs: number;
  maxUploadSizeMb: number;
  /** Ids into font-catalog.ts's UI_FONT_OPTIONS/TERMINAL_FONT_OPTIONS. */
  uiFontFamily: string;
  terminalFontFamily: string;
  uiFontSizePx: number;
  uiLineHeight: number;
  /** Overall UI density/zoom as a percentage (100 = no scaling), applied via CSS `zoom`. */
  uiScalePercent: number;
  /** Whether the first-run setup wizard has already been shown or skipped. */
  onboardingCompleted: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  directory: boolean;
  size: number;
  lastModified: string | null;
  permissions: string;
}

// ---------- S3 Explorer ----------
export interface S3Entry {
  key: string;
  name: string;
  directory: boolean;
  size: number | null;
  lastModified: string | null;
}

export interface S3ListResult {
  bucket: string | null;
  prefix: string;
  entries: S3Entry[];
  /** Present when there's another page to load; echo back as continuationToken. */
  nextToken: string | null;
}

export interface QuickExecuteResult {
  environmentId: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  durationMs: number;
  executedAt: string;
}

export type TabType = 'terminal' | 'files' | 'applications' | 'stage-tracker' | 's3-transfer' | 's3-explorer';

export interface Tab {
  id: string;
  type: TabType;
  environmentId: string;
  title: string;
  /** This tab's position among open tabs of the same type+environment at creation
   * time (1 for the first, 2 for the second, ...). Kept stable for the tab's whole
   * lifetime so a dynamic title update (current folder, current search query) can
   * still append "#2" and stay distinguishable from a sibling tab that happens to
   * land on the same folder/query. */
  ordinal: number;
}

// ---------- YARN applications ----------
export interface YarnApplication {
  applicationId: string;
  applicationName: string;
  applicationType: string;
  user: string;
  queue: string;
  state: string;
  finalStatus: string;
  progressPercent: number | null;
  trackingUrl: string | null;
  startTime: number | null;
  finishTime: number | null;
}

export interface YarnActionResponse {
  success: boolean;
  message: string;
}

export interface YarnNode {
  nodeId: string;
  nodeState: string;
  nodeHttpAddress: string;
  runningContainers: number | null;
}

// ---------- S3 vendor-staging transfer ----------
export type S3FileType = 'out' | 'dif' | 'px';

export interface S3CopyRequest {
  sourcePath: string;
  vendorName: string;
  fileName: string;
  fileType: S3FileType;
  date: string;
  extraArgs?: string;
}

// ---------- File stage tracker ----------
export interface StageMatch {
  applicationId: string;
  applicationName: string;
  state: string;
  finalStatus: string;
  progressPercent: number | null;
  trackingUrl: string | null;
  startTime: number | null;
  finishTime: number | null;
  elapsedMs: number;
  /** Epoch millis of a run timestamp embedded in the application name (e.g.
   * Validation's `..._20260728-022520:349514` suffix), null if not present. */
  runTimestamp: number | null;
}

export type PipelineStage =
  | 'PREPROCESSOR'
  | 'VALIDATION'
  | 'NORMALIZATION'
  | 'DELTA'
  | 'TRANSMISSION'
  | 'OUTBOUND';

export interface StageGroup {
  stage: PipelineStage;
  label: string;
  matches: StageMatch[];
}

export interface FileStageResult {
  coreFileName: string;
  latestCompletedAt: number | null;
  stages: StageGroup[];
  unclassifiedMatches: StageMatch[];
}

export interface StageSearchResult {
  environmentId: string;
  query: string;
  searchedAt: number;
  files: FileStageResult[];
}

export interface StageSearchHistoryEntry {
  id: string;
  environmentId: string;
  environmentName: string;
  filename: string;
  searchedAt: number;
  matchCount: number;
  stageCounts: Record<string, number>;
}

// ---------- Command history (Quick Execute + S3 Transfer) ----------
export type CommandHistorySource = 'QUICK_EXECUTE' | 'S3_TRANSFER';

export interface CommandHistoryEntry {
  id: string;
  environmentId: string;
  environmentName: string;
  source: CommandHistorySource;
  command: string;
  success: boolean;
  exitCode: number;
  durationMs: number;
  executedAt: number;
}
