import { useAppContext } from "../../context/AppContext";
import type { ConnectionStatus, Environment } from "../../types";

interface Props {
  selectedEnvironment: Environment | null;
  status?: ConnectionStatus;
  onNewTerminal: () => void;
  onOpenFiles: () => void;
  onOpenQuickExecute: () => void;
  onOpenSettings: () => void;
}

export default function Toolbar({
  selectedEnvironment,
  status,
  onNewTerminal,
  onOpenFiles,
  onOpenQuickExecute,
  onOpenSettings
}: Props) {
  const { connect, disconnect, reconnect } = useAppContext();
  const connected = status?.state === "CONNECTED";
  const busy = status?.state === "CONNECTING" || status?.state === "RECONNECTING";

  return (
    <header className="toolbar">
      <div className="toolbar-brand">BatchPilot</div>
      <div className="toolbar-actions">
        <button
          className="btn"
          disabled={!selectedEnvironment || connected || busy}
          onClick={() => selectedEnvironment && connect(selectedEnvironment.id)}
        >
          Connect
        </button>
        <button
          className="btn"
          disabled={!selectedEnvironment || !connected}
          onClick={() => selectedEnvironment && disconnect(selectedEnvironment.id)}
        >
          Disconnect
        </button>
        <button
          className="btn"
          disabled={!selectedEnvironment || busy}
          onClick={() => selectedEnvironment && reconnect(selectedEnvironment.id)}
        >
          Reconnect
        </button>
        <div className="toolbar-sep" />
        <button className="btn" disabled={!selectedEnvironment} onClick={onNewTerminal}>
          + Terminal
        </button>
        <button className="btn" disabled={!selectedEnvironment || !connected} onClick={onOpenFiles}>
          Files
        </button>
        <button className="btn" disabled={!selectedEnvironment || !connected} onClick={onOpenQuickExecute}>
          Quick Execute
        </button>
        <div className="toolbar-sep" />
        <button className="btn" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </header>
  );
}
