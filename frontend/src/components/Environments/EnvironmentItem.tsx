import type { ConnectionStatus, Environment } from "../../types";

interface Props {
  environment: Environment;
  status?: ConnectionStatus;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const STATE_LABEL: Record<string, string> = {
  CONNECTED: "Connected",
  CONNECTING: "Connecting…",
  RECONNECTING: "Reconnecting…",
  ERROR: "Error",
  DISCONNECTED: "Disconnected"
};

export default function EnvironmentItem({ environment, status, selected, onSelect, onEdit, onDuplicate, onDelete }: Props) {
  const state = status?.state ?? "DISCONNECTED";

  return (
    <div className={`env-item ${selected ? "env-item-selected" : ""}`} onClick={onSelect}>
      <span className={`health-dot health-${state.toLowerCase()}`} title={STATE_LABEL[state]} />
      <div className="env-item-info">
        <div className="env-item-name">
          {environment.name}
          <span className={`env-badge env-badge-${environment.type.toLowerCase()}`}>{environment.type}</span>
        </div>
        <div className="env-item-detail">
          {environment.username}@{environment.serverIp || "not set"}:{environment.sshPort}
        </div>
      </div>
      <div className="env-item-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title="Edit" onClick={onEdit}>
          ✎
        </button>
        <button className="icon-btn" title="Duplicate" onClick={onDuplicate}>
          ⎘
        </button>
        <button className="icon-btn" title="Delete" onClick={onDelete}>
          ✕
        </button>
      </div>
    </div>
  );
}
