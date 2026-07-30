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
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { AppStateService } from '../core/app-state.service';

// VS Code "Dark+" inspired ANSI palette, with the green slots tied to the
// Fidelity Investments brand green so `ls` colors, prompts, etc. read as part
// of the same theme rather than xterm's generic defaults.
const THEME_DARK = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f78',
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

const THEME_LIGHT = {
  background: '#ffffff',
  foreground: '#1d2129',
  cursor: '#1d2129',
  cursorAccent: '#ffffff',
  selectionBackground: '#add6ff',
  black: '#000000',
  red: '#cd3131',
  green: '#006044',
  yellow: '#949800',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#4f7a1f',
  brightYellow: '#b5ba00',
  brightBlue: '#0451a5',
  brightMagenta: '#bc05bc',
  brightCyan: '#0598bc',
  brightWhite: '#a5a5a5'
};

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

  constructor(private state: AppStateService) {
    effect(() => {
      const settings = this.state.settings();
      if (this.term) {
        this.term.options.fontSize = settings.fontSize;
        this.term.options.theme = settings.theme === 'dark' ? THEME_DARK : THEME_LIGHT;
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
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
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
