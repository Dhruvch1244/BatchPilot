import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { AppSettings, ConnectionStatus, Environment, EnvironmentRequest } from "../types";

interface AppContextValue {
  environments: Environment[];
  statuses: Record<string, ConnectionStatus>;
  settings: AppSettings;
  selectedEnvironmentId: string | null;
  loading: boolean;
  error: string | null;
  selectEnvironment: (id: string | null) => void;
  createEnvironment: (req: EnvironmentRequest) => Promise<Environment>;
  updateEnvironment: (id: string, req: EnvironmentRequest) => Promise<Environment>;
  deleteEnvironment: (id: string) => Promise<void>;
  duplicateEnvironment: (id: string) => Promise<Environment>;
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  reconnect: (id: string) => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  clearError: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  theme: "dark",
  autoReconnect: true,
  reconnectIntervalSeconds: 5,
  maxReconnectAttempts: 5,
  maxTabs: 10,
  maxUploadSizeMb: 512
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  const refreshEnvironments = useCallback(async () => {
    const list = await api.environments.list();
    setEnvironments(list);
    return list;
  }, []);

  const refreshStatus = useCallback(async (id: string) => {
    try {
      const status = await api.connection.status(id);
      setStatuses((prev) => ({ ...prev, [id]: status }));
    } catch {
      // environment may have just been deleted; ignore transient failures
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [envs, appSettings] = await Promise.all([refreshEnvironments(), api.settings.get()]);
        setSettings(appSettings);
        await Promise.all(envs.map((e) => refreshStatus(e.id)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load application state");
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshEnvironments, refreshStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      Object.entries(statusesRef.current).forEach(([id, status]) => {
        if (status.state === "CONNECTED" || status.state === "RECONNECTING" || status.state === "CONNECTING") {
          refreshStatus(id);
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const runOrThrow = useCallback(async <T,>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      setError(message);
      throw e;
    }
  }, []);

  const value: AppContextValue = {
    environments,
    statuses,
    settings,
    selectedEnvironmentId,
    loading,
    error,
    selectEnvironment: setSelectedEnvironmentId,
    createEnvironment: (req) =>
      runOrThrow(async () => {
        const created = await api.environments.create(req);
        await refreshEnvironments();
        return created;
      }),
    updateEnvironment: (id, req) =>
      runOrThrow(async () => {
        const updated = await api.environments.update(id, req);
        await refreshEnvironments();
        return updated;
      }),
    deleteEnvironment: (id) =>
      runOrThrow(async () => {
        await api.environments.remove(id);
        await refreshEnvironments();
        setStatuses((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setSelectedEnvironmentId((current) => (current === id ? null : current));
      }),
    duplicateEnvironment: (id) =>
      runOrThrow(async () => {
        const copy = await api.environments.duplicate(id);
        await refreshEnvironments();
        return copy;
      }),
    connect: (id) =>
      runOrThrow(async () => {
        setStatuses((prev) => ({ ...prev, [id]: { ...prev[id], environmentId: id, state: "CONNECTING" } }));
        const status = await api.connection.connect(id);
        setStatuses((prev) => ({ ...prev, [id]: status }));
      }),
    disconnect: (id) =>
      runOrThrow(async () => {
        const status = await api.connection.disconnect(id);
        setStatuses((prev) => ({ ...prev, [id]: status }));
      }),
    reconnect: (id) =>
      runOrThrow(async () => {
        setStatuses((prev) => ({ ...prev, [id]: { ...prev[id], environmentId: id, state: "RECONNECTING" } }));
        const status = await api.connection.reconnect(id);
        setStatuses((prev) => ({ ...prev, [id]: status }));
      }),
    updateSettings: (newSettings) =>
      runOrThrow(async () => {
        const saved = await api.settings.update(newSettings);
        setSettings(saved);
      }),
    clearError: () => setError(null)
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return ctx;
}
