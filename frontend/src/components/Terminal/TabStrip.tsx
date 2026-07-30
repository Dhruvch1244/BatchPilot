import type { Tab } from "../../types";

interface Props {
  tabs: Tab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export default function TabStrip({ tabs, activeTabId, onSelect, onClose }: Props) {
  return (
    <div className="tab-strip">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-strip-item ${tab.id === activeTabId ? "tab-strip-item-active" : ""}`}
          onClick={() => onSelect(tab.id)}
        >
          <span className="tab-strip-icon">{tab.type === "terminal" ? "⌨" : "📁"}</span>
          <span className="tab-strip-title">{tab.title}</span>
          <button
            className="tab-strip-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
