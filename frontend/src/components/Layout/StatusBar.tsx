import { useEffect, useState } from "react";
import type { ConnectionStatus, Environment } from "../../types";

interface Props {
  selectedEnvironment: Environment | null;
  status?: ConnectionStatus;
}

export default function StatusBar({ selectedEnvironment, status }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const connectedSince = status?.connectedSince ? new Date(status.connectedSince).toLocaleTimeString() : null;

  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        {selectedEnvironment ? (
          <>
            <span className={`health-dot health-${(status?.state ?? "disconnected").toLowerCase()}`} />
            <span>{selectedEnvironment.name}</span>
            <span className="status-bar-sep">|</span>
            <span>{status?.state ?? "DISCONNECTED"}</span>
            {status?.latencyMs != null && (
              <>
                <span className="status-bar-sep">|</span>
                <span>{status.latencyMs} ms</span>
              </>
            )}
            {connectedSince && (
              <>
                <span className="status-bar-sep">|</span>
                <span>since {connectedSince}</span>
              </>
            )}
            {status?.message && status.state === "ERROR" && (
              <>
                <span className="status-bar-sep">|</span>
                <span className="status-bar-error">{status.message}</span>
              </>
            )}
          </>
        ) : (
          <span>No environment selected</span>
        )}
      </div>
      <div className="status-bar-right">{now.toLocaleString()}</div>
    </footer>
  );
}
