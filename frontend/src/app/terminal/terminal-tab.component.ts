import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  effect
} from '@angular/core';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { AppStateService } from '../core/app-state.service';

// VS Code "Dark+" inspired ANSI palette, with the green slots tied to the
// Fidelity Investments brand green so `ls` colors, prompts, etc. read as part
// of the same theme rather than xterm's generic defaults.
const THEME_DARK = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  cursorAccent: '#1e1e1e',
  selection: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#17a370',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#3ecf8e',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5'
};

// "white"/"brightWhite" here are the ANSI slots background-colored text or `ls`
// style listings often render in on a dark terminal, which read as literally
// invisible on the light theme's white background if left anywhere near actual
// white — darkened well past the dark theme's own values for that reason. Green
// is the Fidelity brand green, already dark enough on white to stay readable.
const THEME_LIGHT = {
  background: '#ffffff',
  foreground: '#1d2129',
  cursor: '#1d2129',
  cursorAccent: '#ffffff',
  selection: '#add6ff',
  black: '#000000',
  red: '#cd3131',
  green: '#006044',
  yellow: '#8a7500',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#3a3a3a',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#3f6119',
  brightYellow: '#6e5e00',
  brightBlue: '#0451a5',
  brightMagenta: '#bc05bc',
  brightCyan: '#0598bc',
  brightWhite: '#5c5c5c'
};

// Best-effort: xterm.js just needs a font-family CSS value, so if the user has
// any of these Nerd Fonts installed (common among developers, for powerline/
// prompt glyphs), the terminal picks it up automatically -- no font file is
// bundled with the app, there's nothing to install this from our side.
const TERMINAL_FONT_FAMILY =
  '"CaskaydiaCove Nerd Font", "FiraCode Nerd Font Mono", "Hack Nerd Font Mono", ' +
  '"JetBrainsMono Nerd Font Mono", "MesloLGS NF", "Cascadia Code", ui-monospace, ' +
  '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

// FitAddon.fit() reads renderer measurements that aren't always available yet
// (container mid-layout, tab hidden via display:none, etc.); swallow those.
function safeFit(fitAddon: FitAddon): void {
  try {
    fitAddon.fit();
  } catch {
    // not measurable yet; a later resize/activation will retry
  }
}

@Component({
  selector: 'app-terminal-tab',
  standalone: true,
  template: `
    <div class="terminal-tab" [style.background]="background()">
      <div class="terminal-status-banner" [style.display]="statusMessage ? 'block' : 'none'">{{ statusMessage }}</div>
      <div class="terminal-host" #host></div>
    </div>
  `
})
export class TerminalTabComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) environmentId!: string;
  @Input() active = false;

  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  statusMessage = '';

  private term?: Terminal;
  private fitAddon?: FitAddon;
  private ws?: WebSocket;
  private resizeObserver?: ResizeObserver;
  /** True once the server confirms the PTY channel is actually open. Keystrokes typed
   * before that (the WebSocket itself opens before the SSH shell channel does, which can
   * take a real network round-trip) are queued here instead of sent — otherwise the
   * server silently drops them (no session registered yet for this connection), which
   * looks like "the terminal isn't responding" to whoever typed them. */
  private ready = false;
  private pendingInput: string[] = [];

  constructor(private state: AppStateService) {
    effect(() => {
      const settings = this.state.settings();
      if (this.term) {
        this.term.setOption('fontSize', settings.fontSize);
        this.term.setOption('theme', settings.theme === 'dark' ? THEME_DARK : THEME_LIGHT);
        if (this.fitAddon) safeFit(this.fitAddon);
      }
    });
  }

  background(): string {
    return this.state.settings().theme === 'dark' ? THEME_DARK.background : THEME_LIGHT.background;
  }

  ngAfterViewInit(): void {
    const container = this.hostRef.nativeElement;
    const settings = this.state.settings();

    const term = new Terminal({
      fontSize: settings.fontSize,
      fontFamily: TERMINAL_FONT_FAMILY,
      theme: settings.theme === 'dark' ? THEME_DARK : THEME_LIGHT,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    safeFit(fitAddon);

    this.term = term;
    this.fitAddon = fitAddon;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/terminal/${this.environmentId}?cols=${term.cols}&rows=${term.rows}`
    );
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => (this.statusMessage = '');
    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'error') {
            this.statusMessage = msg.message ?? 'Terminal error';
          } else if (msg.type === 'status') {
            this.statusMessage = '';
            this.ready = true;
            this.flushPendingInput(ws);
          }
        } catch {
          term.write(event.data);
        }
      } else {
        term.write(new Uint8Array(event.data as ArrayBuffer));
      }
    };
    ws.onclose = () => (this.statusMessage = 'Disconnected from terminal');
    ws.onerror = () => (this.statusMessage = 'Terminal connection error');

    term.onData((data) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }
      if (this.ready) {
        ws.send(new TextEncoder().encode(data));
      } else {
        this.pendingInput.push(data);
      }
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    this.resizeObserver = new ResizeObserver(() => safeFit(fitAddon));
    this.resizeObserver.observe(container);
  }

  private flushPendingInput(ws: WebSocket): void {
    if (this.pendingInput.length === 0) return;
    const buffered = this.pendingInput.join('');
    this.pendingInput = [];
    ws.send(new TextEncoder().encode(buffered));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['active'] && this.active && this.fitAddon && this.term) {
      safeFit(this.fitAddon);
      this.term.focus();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.ws?.close();
    this.term?.dispose();
  }
}
