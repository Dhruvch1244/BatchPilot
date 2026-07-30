import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import type { EnvironmentFormState } from "../Layout/AppShell";
import type { EnvironmentRequest, EnvironmentType } from "../../types";
import Modal from "../common/Modal";

interface Props {
  state: NonNullable<EnvironmentFormState>;
  onClose: () => void;
}

export default function EnvironmentFormModal({ state, onClose }: Props) {
  const { createEnvironment, updateEnvironment } = useAppContext();
  const editing = state.mode === "edit";
  const initial = editing ? state.environment : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<EnvironmentType>(initial?.type ?? "CUSTOM");
  const [serverIp, setServerIp] = useState(initial?.serverIp ?? "");
  const [sshPort, setSshPort] = useState(initial?.sshPort ?? 22);
  const [ppkPath, setPpkPath] = useState(initial?.ppkPath ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const request: EnvironmentRequest = { name, type, serverIp, sshPort, ppkPath };
    try {
      if (editing) {
        await updateEnvironment(initial!.id, request);
      } else {
        await createEnvironment(request);
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save environment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={editing ? "Edit Environment" : "New Environment"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <label className="form-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>

        <label className="form-field">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as EnvironmentType)}>
            <option value="DEV">DEV</option>
            <option value="UAT">UAT</option>
            <option value="CUSTOM">CUSTOM</option>
          </select>
        </label>

        <label className="form-field">
          <span>Server IP</span>
          <input value={serverIp} onChange={(e) => setServerIp(e.target.value)} placeholder="10.0.0.5" required />
        </label>

        <label className="form-field">
          <span>SSH Port</span>
          <input
            type="number"
            min={1}
            max={65535}
            value={sshPort}
            onChange={(e) => setSshPort(Number(e.target.value))}
            required
          />
        </label>

        <label className="form-field">
          <span>PPK Path</span>
          <input
            value={ppkPath}
            onChange={(e) => setPpkPath(e.target.value)}
            placeholder="/path/to/key.ppk"
            required
          />
        </label>

        <label className="form-field">
          <span>Username</span>
          <input value={initial?.username ?? "hadoop"} disabled />
        </label>

        {formError && <div className="form-error">{formError}</div>}

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {editing ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
