import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { FileEntry } from "../../types";

interface Props {
  environmentId: string;
}

type ViewMode = "table" | "grid";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export default function FileManagerPanel({ environmentId }: Props) {
  const [path, setPath] = useState(".");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.files.list(environmentId, path, search || undefined);
      setEntries(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list directory");
    } finally {
      setLoading(false);
    }
  }, [environmentId, path, search]);

  useEffect(() => {
    load();
    setSelected(new Set());
  }, [load]);

  const navigateInto = (entry: FileEntry) => {
    if (entry.directory) {
      setPath(entry.path);
    }
  };

  const navigateUp = () => {
    if (path === "." || path === "/") return;
    const trimmed = path.replace(/\/+$/, "");
    const parent = trimmed.substring(0, trimmed.lastIndexOf("/"));
    setPath(parent === "" ? "/" : parent);
  };

  const toggleSelect = (entryPath: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entryPath)) next.delete(entryPath);
      else next.add(entryPath);
      return next;
    });
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadProgress({ loaded: 0, total: 1 });
    try {
      await api.files.upload(environmentId, path, files, (loaded, total) => setUploadProgress({ loaded, total }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadProgress(null);
    }
  };

  const downloadSelected = () => {
    entries
      .filter((entry) => selected.has(entry.path) && !entry.directory)
      .forEach((entry) => {
        const a = document.createElement("a");
        a.href = api.files.downloadUrl(environmentId, entry.path);
        a.download = entry.name;
        a.click();
      });
  };

  return (
    <div
      className={`file-manager ${dragOver ? "file-manager-drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        uploadFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="file-manager-toolbar">
        <button className="btn" onClick={navigateUp} disabled={path === "." || path === "/"}>
          ↑ Up
        </button>
        <input className="file-manager-path" value={path} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <input
          className="file-manager-search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn" onClick={() => fileInputRef.current?.click()}>
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => uploadFiles(Array.from(e.target.files ?? []))}
        />
        <button className="btn" disabled={selected.size === 0} onClick={downloadSelected}>
          Download ({selected.size})
        </button>
        <div className="view-toggle">
          <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>
            ☰
          </button>
          <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>
            ▦
          </button>
        </div>
      </div>

      {uploadProgress && (
        <div className="upload-progress">
          <div
            className="upload-progress-bar"
            style={{ width: `${Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%` }}
          />
        </div>
      )}

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="file-manager-loading">Loading…</div>}

      {!loading && view === "table" && (
        <table className="file-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Size</th>
              <th>Modified</th>
              <th>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.path}
                className={selected.has(entry.path) ? "row-selected" : ""}
                onDoubleClick={() => navigateInto(entry)}
              >
                <td>
                  <input type="checkbox" checked={selected.has(entry.path)} onChange={() => toggleSelect(entry.path)} />
                </td>
                <td>
                  {entry.directory ? "📁" : "📄"} {entry.name}
                </td>
                <td>{entry.directory ? "—" : formatSize(entry.size)}</td>
                <td>{entry.lastModified ? new Date(entry.lastModified).toLocaleString() : "—"}</td>
                <td>{entry.permissions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && view === "grid" && (
        <div className="file-grid">
          {entries.map((entry) => (
            <div
              key={entry.path}
              className={`file-grid-item ${selected.has(entry.path) ? "row-selected" : ""}`}
              onClick={() => toggleSelect(entry.path)}
              onDoubleClick={() => navigateInto(entry)}
            >
              <div className="file-grid-icon">{entry.directory ? "📁" : "📄"}</div>
              <div className="file-grid-name">{entry.name}</div>
              {!entry.directory && <div className="file-grid-size">{formatSize(entry.size)}</div>}
            </div>
          ))}
        </div>
      )}

      {dragOver && <div className="drop-overlay">Drop files to upload to {path}</div>}
    </div>
  );
}
