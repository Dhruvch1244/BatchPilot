export type EnvironmentType = "DEV" | "UAT" | "CUSTOM";

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

export type ConnectionState = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "ERROR";

export interface ConnectionStatus {
  environmentId: string;
  state: ConnectionState;
  message?: string | null;
  latencyMs?: number | null;
  connectedSince?: number | null;
}

export interface AppSettings {
  fontSize: number;
  theme: "dark" | "light";
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

export interface ApiError {
  status: number;
  error: string;
  message: string;
}

export type TabType = "terminal" | "files";

export interface Tab {
  id: string;
  type: TabType;
  environmentId: string;
  title: string;
}
