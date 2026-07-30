import { useAppContext } from "../../context/AppContext";
import type { Environment } from "../../types";
import EnvironmentItem from "../Environments/EnvironmentItem";

interface Props {
  onCreateEnvironment: () => void;
  onEditEnvironment: (env: Environment) => void;
}

export default function Sidebar({ onCreateEnvironment, onEditEnvironment }: Props) {
  const { environments, statuses, selectedEnvironmentId, selectEnvironment, duplicateEnvironment, deleteEnvironment } =
    useAppContext();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>Environments</span>
        <button className="icon-btn" title="New Environment" onClick={onCreateEnvironment}>
          +
        </button>
      </div>
      <div className="sidebar-list">
        {environments.length === 0 && <div className="sidebar-empty">No environments yet.</div>}
        {environments.map((env) => (
          <EnvironmentItem
            key={env.id}
            environment={env}
            status={statuses[env.id]}
            selected={env.id === selectedEnvironmentId}
            onSelect={() => selectEnvironment(env.id)}
            onEdit={() => onEditEnvironment(env)}
            onDuplicate={() => duplicateEnvironment(env.id)}
            onDelete={() => {
              if (window.confirm(`Delete environment "${env.name}"?`)) {
                deleteEnvironment(env.id);
              }
            }}
          />
        ))}
      </div>
    </aside>
  );
}
