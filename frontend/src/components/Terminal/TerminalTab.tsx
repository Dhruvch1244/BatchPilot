import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useAppContext } from "../../context/AppContext";

interface Props {
  environmentId: string;
  active: boolean;
}

// VS Code "Dark+" inspired ANSI palette so ls colors, prompts, etc. render
// with correct fidelity rather than xterm's washed-out defaults.
const THEME_DARK = {
  background: "#1e1e1e",
  foreground: "#d4d4d4",
  cursor: "#d4d4d4",
  cursorAccent: "#1e1e1e",
  selectionBackground: "#264f78",
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#e5e5e5"
};

// VS Code "Light+" inspired ANSI palette, darkened just enough from the
// dark-mode hues to stay readable on a white background.
const THEME_LIGHT = {
  background: "#ffffff",
  foreground: "#1d2129",
  cursor: "#1d2129",
  cursorAccent: "#ffffff",
  selectionBackground: "#add6ff",
  black: "#000000",
  red: "#cd3131",
  green: "#00762e",
  yellow: "#949800",
  blue: "#0451a5",
  magenta: "#bc05bc",
  cyan: "#0598bc",
  white: "#555555",
  brightBlack: "#666666",
  brightRed: "#cd3131",
  brightGreen: "#14ce14",
  brightYellow: "#b5ba00",
  brightBlue: "#0451a5",
  brightMagenta: "#bc05bc",
  brightCyan: "#0598bc",
  brightWhite: "#a5a5a5"
};

// FitAddon.fit() reads renderer measurements that aren't always available yet
// (container mid-layout, tab hidden via display:none, etc.); swallow those.
function safeFit(fitAddon: FitAddon) {
  try {
    fitAddon.fit();
  } catch {
    // not measurable yet; a later resize/activation will retry
  }
}

export default function TerminalTab({ environmentId, active }: Props) {
  const { settings } = useAppContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontSize: settings.fontSize,
      theme: settings.theme === "dark" ? THEME_DARK : THEME_LIGHT,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    safeFit(fitAddon);

    termRef.current = term;
    fitRef.current = fitAddon;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/terminal/${environmentId}?cols=${term.cols}&rows=${term.rows}`
    );
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("");
    };
    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "error") {
            setStatus(msg.message ?? "Terminal error");
          } else if (msg.type === "status") {
            setStatus("");
          }
        } catch {
          term.write(event.data);
        }
      } else {
        term.write(new Uint8Array(event.data as ArrayBuffer));
      }
    };
    ws.onclose = () => setStatus("Disconnected from terminal");
    ws.onerror = () => setStatus("Terminal connection error");

    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    const resizeObserver = new ResizeObserver(() => safeFit(fitAddon));
    resizeObserver.observe(container);

    function setStatus(message: string) {
      if (statusRef.current) {
        statusRef.current.textContent = message;
        statusRef.current.style.display = message ? "block" : "none";
      }
    }

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
      // React StrictMode mounts/unmounts/remounts this effect once in dev;
      // without clearing the container, xterm's remount can inherit stale
      // renderer state from the just-disposed instance.
      container.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environmentId]);

  useEffect(() => {
    if (active && fitRef.current && termRef.current) {
      safeFit(fitRef.current);
      termRef.current.focus();
    }
  }, [active]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = settings.fontSize;
      termRef.current.options.theme = settings.theme === "dark" ? THEME_DARK : THEME_LIGHT;
      if (fitRef.current) safeFit(fitRef.current);
    }
  }, [settings.fontSize, settings.theme]);

  const bg = settings.theme === "dark" ? THEME_DARK.background : THEME_LIGHT.background;

  return (
    <div className="terminal-tab" style={{ background: bg }}>
      <div className="terminal-status-banner" ref={statusRef} style={{ display: "none" }} />
      <div className="terminal-host" ref={containerRef} />
    </div>
  );
}
