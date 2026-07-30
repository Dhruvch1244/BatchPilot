import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { api } from "../../api/client";
import type { QuickExecuteResult } from "../../types";

interface Props {
  environmentId: string | null;
  onClose: () => void;
}

export default function QuickExecutePanel({ environmentId, onClose }: Props) {
  const { environments, statuses } = useAppContext();
  const connectedEnvironments = environments.filter((e) => statuses[e.id]?.state === "CONNECTED");
  const [targetId, setTargetId] = useState(environmentId ?? connectedEnvironments[0]?.id ?? "");
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<QuickExecuteResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!targetId || !command.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const result = await api.quickExecute.run(targetId, command);
      setHistory((prev) => [result, ...prev].slice(0, 20));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command failed to execute");
    } finally {
      setRunning(false);
    }
  };

  const copyOutput = (result: QuickExecuteResult) => {
    navigator.clipboard.writeText([result.stdout, result.stderr].filter(Boolean).join("\n"));
  };

  const downloadOutput = (result: QuickExecuteResult) => {
    const blob = new Blob([`$ ${result.command}\n\n${result.stdout}\n${result.stderr}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quick-execute-${result.executedAt.replace(/[:.]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="quick-execute-panel">
      <div className="panel-header">
        <span>Quick Execute</span>
        <button className="icon-btn" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="panel-body">
        <label className="form-field">
          <span>Environment</span>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="" disabled>
              Select a connected environment
            </option>
            {connectedEnvironments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Command</span>
          <textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="e.g. df -h"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                run();
              }
            }}
          />
        </label>

        <button className="btn btn-primary" disabled={running || !targetId || !command.trim()} onClick={run}>
          {running ? "Running…" : "Run (Ctrl/Cmd+Enter)"}
        </button>

        {error && <div className="form-error">{error}</div>}

        <div className="quick-execute-history">
          {history.map((result, idx) => (
            <div key={idx} className="quick-execute-result">
              <div className="quick-execute-result-header">
                <span className={`status-badge ${result.success ? "status-success" : "status-failure"}`}>
                  {result.success ? "SUCCESS" : `EXIT ${result.exitCode}`}
                </span>
                <span className="quick-execute-duration">{result.durationMs} ms</span>
                <div className="quick-execute-result-actions">
                  <button className="icon-btn" title="Copy output" onClick={() => copyOutput(result)}>
                    ⧉
                  </button>
                  <button className="icon-btn" title="Download output" onClick={() => downloadOutput(result)}>
                    ⬇
                  </button>
                </div>
              </div>
              <div className="quick-execute-command">$ {result.command}</div>
              {result.stdout && <pre className="quick-execute-output quick-execute-stdout">{result.stdout}</pre>}
              {result.stderr && <pre className="quick-execute-output quick-execute-stderr">{result.stderr}</pre>}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
