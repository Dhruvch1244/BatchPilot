export type EnvironmentType = 'DEV' | 'UAT' | 'CUSTOM';

export interface Environment {
  id: string;
  name: string;
  type: EnvironmentType;
  serverIp: string;
  sshPort: number;
  ppkPath: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentRequest {
  name: string;
  type: EnvironmentType;
  serverIp: string;
  sshPort: number;
  ppkPath: string;
}

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface ConnectionStatus {
  environmentId: string;
  state: ConnectionState;
  message?: string | null;
  latencyMs?: number | null;
  connectedSince?: number | null;
}

export interface AppSettings {
  fontSize: number;
  theme: 'dark' | 'light';
  autoReconnect: boolean;
  reconnectIntervalSeconds: number;
  maxReconnectAttempts: number;
  maxTabs: number;
  maxUploadSizeMb: number;
}

export interface FileEntry {
  name: string;
  path: string;
  directory: boolean;
  size: number;
  lastModified: string | null;
  permissions: string;
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

export type TabType = 'terminal' | 'files' | 'applications' | 'stage-tracker' | 's3-transfer';

export interface Tab {
  id: string;
  type: TabType;
  environmentId: string;
  title: string;
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
}

export type PipelineStage = 'PREPROCESSOR' | 'VALIDATION' | 'NORMALIZATION' | 'DAAF' | 'TRANSMISSION';

export interface StageGroup {
  stage: PipelineStage;
  label: string;
  matches: StageMatch[];
}

export interface StageSearchResult {
  environmentId: string;
  filename: string;
  searchedAt: number;
  stages: StageGroup[];
  unclassifiedMatches: StageMatch[];
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
