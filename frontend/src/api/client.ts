import type {
  AppSettings,
  ConnectionStatus,
  Environment,
  EnvironmentRequest,
  FileEntry,
  QuickExecuteResult
} from "../types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      // response had no JSON body
    }
    throw new Error(message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  environments: {
    list: () => request<Environment[]>("/api/environments"),
    get: (id: string) => request<Environment>(`/api/environments/${id}`),
    create: (body: EnvironmentRequest) =>
      request<Environment>("/api/environments", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: EnvironmentRequest) =>
      request<Environment>(`/api/environments/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    duplicate: (id: string) => request<Environment>(`/api/environments/${id}/duplicate`, { method: "POST" }),
    remove: (id: string) => request<void>(`/api/environments/${id}`, { method: "DELETE" })
  },
  connection: {
    connect: (id: string) =>
      request<ConnectionStatus>(`/api/environments/${id}/connection/connect`, { method: "POST" }),
    disconnect: (id: string) =>
      request<ConnectionStatus>(`/api/environments/${id}/connection/disconnect`, { method: "POST" }),
    reconnect: (id: string) =>
      request<ConnectionStatus>(`/api/environments/${id}/connection/reconnect`, { method: "POST" }),
    status: (id: string) => request<ConnectionStatus>(`/api/environments/${id}/connection/status`),
    health: (id: string) => request<ConnectionStatus>(`/api/environments/${id}/connection/health`)
  },
  quickExecute: {
    run: (environmentId: string, command: string, timeoutSeconds?: number) =>
      request<QuickExecuteResult>("/api/quick-execute", {
        method: "POST",
        body: JSON.stringify({ environmentId, command, timeoutSeconds })
      })
  },
  files: {
    list: (environmentId: string, path: string, search?: string) => {
      const params = new URLSearchParams({ path });
      if (search) params.set("search", search);
      return request<FileEntry[]>(`/api/environments/${environmentId}/files?${params.toString()}`);
    },
    downloadUrl: (environmentId: string, path: string) =>
      `/api/environments/${environmentId}/files/download?${new URLSearchParams({ path }).toString()}`,
    upload: async (
      environmentId: string,
      path: string,
      files: File[],
      onProgress?: (loaded: number, total: number) => void
    ) => {
      const form = new FormData();
      form.append("path", path);
      files.forEach((file) => form.append("files", file));

      return new Promise<Record<string, string>>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/environments/${environmentId}/files/upload`);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress?.(event.loaded, event.total);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(form);
      });
    }
  },
  settings: {
    get: () => request<AppSettings>("/api/settings"),
    update: (settings: AppSettings) =>
      request<AppSettings>("/api/settings", { method: "PUT", body: JSON.stringify(settings) })
  }
};
