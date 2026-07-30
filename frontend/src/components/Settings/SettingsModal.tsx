import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import type { AppSettings } from "../../types";
import Modal from "../common/Modal";

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const { settings, updateSettings } = useAppContext();
  const [form, setForm] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateSettings(form);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="form">
        <label className="form-field">
          <span>Font Size</span>
          <input
            type="number"
            min={8}
            max={32}
            value={form.fontSize}
            onChange={(e) => setForm({ ...form, fontSize: Number(e.target.value) })}
          />
        </label>

        <label className="form-field">
          <span>Theme</span>
          <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value as "dark" | "light" })}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <label className="form-field form-field-row">
          <span>Auto-reconnect</span>
          <input
            type="checkbox"
            checked={form.autoReconnect}
            onChange={(e) => setForm({ ...form, autoReconnect: e.target.checked })}
          />
        </label>

        <label className="form-field">
          <span>Reconnect interval (seconds)</span>
          <input
            type="number"
            min={1}
            max={120}
            value={form.reconnectIntervalSeconds}
            onChange={(e) => setForm({ ...form, reconnectIntervalSeconds: Number(e.target.value) })}
            disabled={!form.autoReconnect}
          />
        </label>

        <label className="form-field">
          <span>Max reconnect attempts</span>
          <input
            type="number"
            min={1}
            max={50}
            value={form.maxReconnectAttempts}
            onChange={(e) => setForm({ ...form, maxReconnectAttempts: Number(e.target.value) })}
            disabled={!form.autoReconnect}
          />
        </label>

        <label className="form-field">
          <span>Max terminal tabs</span>
          <input
            type="number"
            min={1}
            max={50}
            value={form.maxTabs}
            onChange={(e) => setForm({ ...form, maxTabs: Number(e.target.value) })}
          />
        </label>

        <label className="form-field">
          <span>Max upload size (MB)</span>
          <input
            type="number"
            min={1}
            value={form.maxUploadSizeMb}
            onChange={(e) => setForm({ ...form, maxUploadSizeMb: Number(e.target.value) })}
          />
        </label>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
