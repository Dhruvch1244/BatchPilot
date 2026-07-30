import { useCallback, useState } from "react";
import { useAppContext } from "../../context/AppContext";
import type { Environment, Tab } from "../../types";
import Sidebar from "./Sidebar";
import Toolbar from "./Toolbar";
import StatusBar from "./StatusBar";
import TabStrip from "../Terminal/TabStrip";
import TerminalTab from "../Terminal/TerminalTab";
import FileManagerPanel from "../FileManager/FileManagerPanel";
import QuickExecutePanel from "../QuickExecute/QuickExecutePanel";
import SettingsModal from "../Settings/SettingsModal";
import EnvironmentFormModal from "../Environments/EnvironmentFormModal";

let tabCounter = 0;
function nextTabId() {
  tabCounter += 1;
  return `tab-${Date.now()}-${tabCounter}`;
}

export type EnvironmentFormState = { mode: "create" } | { mode: "edit"; environment: Environment } | null;

export default function AppShell() {
  const { environments, statuses, selectedEnvironmentId, selectEnvironment, connect, settings, error, clearError } =
    useAppContext();

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [quickExecuteOpen, setQuickExecuteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [environmentForm, setEnvironmentForm] = useState<EnvironmentFormState>(null);

  const selectedEnvironment = environments.find((e) => e.id === selectedEnvironmentId) ?? null;
  const selectedStatus = selectedEnvironmentId ? statuses[selectedEnvironmentId] : undefined;

  const openTerminalTab = useCallback(
    (environmentId: string) => {
      const terminalTabCount = tabs.filter((t) => t.type === "terminal").length;
      if (terminalTabCount >= settings.maxTabs) {
        window.alert(`Maximum of ${settings.maxTabs} terminal tabs reached. Close a tab or raise the limit in Settings.`);
        return;
      }
      const env = environments.find((e) => e.id === environmentId);
      const id = nextTabId();
      const title = `${env?.name ?? "Terminal"} #${terminalTabCount + 1}`;
      setTabs((prev) => [...prev, { id, type: "terminal", environmentId, title }]);
      setActiveTabId(id);
    },
    [tabs, settings.maxTabs, environments]
  );

  const openFilesTab = useCallback(
    (environmentId: string) => {
      const existing = tabs.find((t) => t.type === "files" && t.environmentId === environmentId);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }
      const env = environments.find((e) => e.id === environmentId);
      const id = nextTabId();
      setTabs((prev) => [...prev, { id, type: "files", environmentId, title: `${env?.name ?? "Files"} — Explorer` }]);
      setActiveTabId(id);
    },
    [tabs, environments]
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          setActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const handleNewTerminal = useCallback(async () => {
    if (!selectedEnvironmentId) return;
    if (statuses[selectedEnvironmentId]?.state !== "CONNECTED") {
      await connect(selectedEnvironmentId);
    }
    openTerminalTab(selectedEnvironmentId);
  }, [selectedEnvironmentId, statuses, connect, openTerminalTab]);

  return (
    <div className={`app-shell theme-${settings.theme}`}>
      <Toolbar
        selectedEnvironment={selectedEnvironment}
        status={selectedStatus}
        onNewTerminal={handleNewTerminal}
        onOpenFiles={() => selectedEnvironmentId && openFilesTab(selectedEnvironmentId)}
        onOpenQuickExecute={() => setQuickExecuteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="app-body">
        <Sidebar
          onCreateEnvironment={() => setEnvironmentForm({ mode: "create" })}
          onEditEnvironment={(env) => setEnvironmentForm({ mode: "edit", environment: env })}
        />
        <main className="main-content">
          {tabs.length === 0 ? (
            <EmptyState
              hasEnvironments={environments.length > 0}
              onCreateEnvironment={() => setEnvironmentForm({ mode: "create" })}
            />
          ) : (
            <>
              <TabStrip tabs={tabs} activeTabId={activeTabId} onSelect={setActiveTabId} onClose={closeTab} />
              <div className="tab-panels">
                {tabs.map((tab) => (
                  <div key={tab.id} className="tab-panel" style={{ display: tab.id === activeTabId ? "flex" : "none" }}>
                    {tab.type === "terminal" ? (
                      <TerminalTab environmentId={tab.environmentId} active={tab.id === activeTabId} />
                    ) : (
                      <FileManagerPanel environmentId={tab.environmentId} />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
        {quickExecuteOpen && (
          <QuickExecutePanel
            environmentId={selectedEnvironmentId}
            onClose={() => setQuickExecuteOpen(false)}
          />
        )}
      </div>
      <StatusBar selectedEnvironment={selectedEnvironment} status={selectedStatus} />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {environmentForm && (
        <EnvironmentFormModal state={environmentForm} onClose={() => setEnvironmentForm(null)} />
      )}
      {error && (
        <div className="toast-error" onClick={clearError}>
          {error}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  hasEnvironments,
  onCreateEnvironment
}: {
  hasEnvironments: boolean;
  onCreateEnvironment: () => void;
}) {
  return (
    <div className="empty-state">
      {hasEnvironments ? (
        <>
          <h2>No tabs open</h2>
          <p>Select an environment from the sidebar, then Connect and open a terminal.</p>
        </>
      ) : (
        <>
          <h2>Welcome to BatchPilot</h2>
          <p>Create your first environment to get started.</p>
          <button className="btn btn-primary" onClick={onCreateEnvironment}>
            + New Environment
          </button>
        </>
      )}
    </div>
  );
}
