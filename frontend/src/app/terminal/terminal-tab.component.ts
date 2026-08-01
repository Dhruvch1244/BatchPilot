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
import { AppTheme } from '../core/models';
import { TERMINAL_FONT_OPTIONS, fontStackFor } from '../core/font-catalog';

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

// Official Dracula terminal palette (draculatheme.com/terminal).
const THEME_DRACULA = {
  background: '#282a36',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#282a36',
  selection: '#44475a',
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff'
};

// Standard Nord terminal palette (nordtheme.com).
const THEME_NORD = {
  background: '#2e3440',
  foreground: '#d8dee9',
  cursor: '#d8dee9',
  cursorAccent: '#2e3440',
  selection: '#434c5e',
  black: '#3b4252',
  red: '#bf616a',
  green: '#a3be8c',
  yellow: '#ebcb8b',
  blue: '#81a1c1',
  magenta: '#b48ead',
  cyan: '#88c0d0',
  white: '#e5e9f0',
  brightBlack: '#4c566a',
  brightRed: '#bf616a',
  brightGreen: '#a3be8c',
  brightYellow: '#ebcb8b',
  brightBlue: '#81a1c1',
  brightMagenta: '#b48ead',
  brightCyan: '#8fbcbb',
  brightWhite: '#eceff4'
};

// Standard Solarized palette, light variant. "white"/"brightWhite" darkened
// past the official spec values (which run close to the background itself)
// for the same reason THEME_LIGHT's were darkened above - unreadable
// otherwise on a light background.
const THEME_SOLARIZED_LIGHT = {
  background: '#fdf6e3',
  foreground: '#657b83',
  cursor: '#657b83',
  cursorAccent: '#fdf6e3',
  selection: '#eee8d5',
  black: '#073642',
  red: '#dc322f',
  green: '#859900',
  yellow: '#b58900',
  blue: '#268bd2',
  magenta: '#d33682',
  cyan: '#2aa198',
  white: '#586e75',
  brightBlack: '#002b36',
  brightRed: '#cb4b16',
  brightGreen: '#586e75',
  brightYellow: '#657b83',
  brightBlue: '#268bd2',
  brightMagenta: '#6c71c4',
  brightCyan: '#2aa198',
  brightWhite: '#073642'
};

// Standard "Atom One Dark" terminal palette.
const THEME_ONE_DARK = {
  background: '#282c34',
  foreground: '#abb2bf',
  cursor: '#abb2bf',
  cursorAccent: '#282c34',
  selection: '#3e4451',
  black: '#282c34',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff'
};

// Standard Monokai terminal palette.
const THEME_MONOKAI = {
  background: '#272822',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#272822',
  selection: '#49483e',
  black: '#272822',
  red: '#f92672',
  green: '#a6e22e',
  yellow: '#f4bf75',
  blue: '#66d9ef',
  magenta: '#ae81ff',
  cyan: '#a1efe4',
  white: '#f8f8f2',
  brightBlack: '#75715e',
  brightRed: '#f92672',
  brightGreen: '#a6e22e',
  brightYellow: '#f4bf75',
  brightBlue: '#66d9ef',
  brightMagenta: '#ae81ff',
  brightCyan: '#a1efe4',
  brightWhite: '#f9f8f5'
};

// ---------- Neovim-inspired terminal palettes ----------
// Each is sourced from that colorscheme's own published/official palette (its GitHub repo,
// or - for the handful of variants without a single canonical terminal.md - the same hex
// values its editor syntax highlighting uses, mapped onto the nearest matching ANSI slot).

const THEME_CATPPUCCIN_MOCHA = {
  background: '#1e1e2e', foreground: '#cdd6f4', cursor: '#f5e0dc', cursorAccent: '#1e1e2e', selection: '#585b70',
  black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af', blue: '#89b4fa', magenta: '#cba6f7',
  cyan: '#94e2d5', white: '#bac2de', brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#cba6f7', brightCyan: '#94e2d5', brightWhite: '#a6adc8'
};

const THEME_CATPPUCCIN_LATTE = {
  background: '#eff1f5', foreground: '#4c4f69', cursor: '#dc8a78', cursorAccent: '#eff1f5', selection: '#acb0be',
  black: '#5c5f77', red: '#d20f39', green: '#40a02b', yellow: '#df8e1d', blue: '#1e66f5', magenta: '#8839ef',
  cyan: '#179299', white: '#acb0be', brightBlack: '#6c6f85', brightRed: '#d20f39', brightGreen: '#40a02b',
  brightYellow: '#df8e1d', brightBlue: '#1e66f5', brightMagenta: '#8839ef', brightCyan: '#179299', brightWhite: '#bcc0cc'
};

const THEME_TOKYONIGHT = {
  background: '#1a1b26', foreground: '#c0caf5', cursor: '#c0caf5', cursorAccent: '#1a1b26', selection: '#283457',
  black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7', magenta: '#bb9af7',
  cyan: '#7dcfff', white: '#a9b1d6', brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a',
  brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5'
};

const THEME_TOKYONIGHT_STORM = {
  ...THEME_TOKYONIGHT,
  background: '#24283b', cursorAccent: '#24283b', selection: '#364a82', black: '#1d202f'
};

const THEME_TOKYONIGHT_DAY = {
  background: '#e1e2e7', foreground: '#343b58', cursor: '#3760bf', cursorAccent: '#e1e2e7', selection: '#b6bfe2',
  black: '#b4b5b9', red: '#f52a65', green: '#587539', yellow: '#8c6c3e', blue: '#2e7de9', magenta: '#9854f1',
  cyan: '#007197', white: '#343b58', brightBlack: '#a1a6c5', brightRed: '#f52a65', brightGreen: '#587539',
  brightYellow: '#8c6c3e', brightBlue: '#2e7de9', brightMagenta: '#9854f1', brightCyan: '#007197', brightWhite: '#343b58'
};

const THEME_GRUVBOX_DARK = {
  background: '#282828', foreground: '#ebdbb2', cursor: '#ebdbb2', cursorAccent: '#282828', selection: '#504945',
  black: '#282828', red: '#cc241d', green: '#98971a', yellow: '#d79921', blue: '#458588', magenta: '#b16286',
  cyan: '#689d6a', white: '#a89984', brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26',
  brightYellow: '#fabd2f', brightBlue: '#83a598', brightMagenta: '#d3869b', brightCyan: '#8ec07c', brightWhite: '#ebdbb2'
};

const THEME_GRUVBOX_LIGHT = {
  background: '#fbf1c7', foreground: '#3c3836', cursor: '#3c3836', cursorAccent: '#fbf1c7', selection: '#ebdbb2',
  black: '#fbf1c7', red: '#cc241d', green: '#98971a', yellow: '#d79921', blue: '#458588', magenta: '#b16286',
  cyan: '#689d6a', white: '#7c6f64', brightBlack: '#928374', brightRed: '#9d0006', brightGreen: '#79740e',
  brightYellow: '#b57614', brightBlue: '#076678', brightMagenta: '#8f3f71', brightCyan: '#427b58', brightWhite: '#3c3836'
};

// Official Kanagawa palette (github.com/rebelot/kanagawa.nvim) - sumiInk/fujiWhite/crystalBlue/etc.
const THEME_KANAGAWA = {
  background: '#1f1f28', foreground: '#dcd7ba', cursor: '#c8c093', cursorAccent: '#1f1f28', selection: '#2d4f67',
  black: '#090618', red: '#c34043', green: '#76946a', yellow: '#c0a36e', blue: '#7e9cd8', magenta: '#957fb8',
  cyan: '#6a9589', white: '#c8c093', brightBlack: '#727169', brightRed: '#e82424', brightGreen: '#98bb6c',
  brightYellow: '#e6c384', brightBlue: '#7fb4ca', brightMagenta: '#938aa9', brightCyan: '#7aa89f', brightWhite: '#dcd7ba'
};

// Official Rosé Pine palette (rosepinetheme.com/palette) - main variant.
const THEME_ROSE_PINE = {
  background: '#191724', foreground: '#e0def4', cursor: '#e0def4', cursorAccent: '#191724', selection: '#403d52',
  black: '#26233a', red: '#eb6f92', green: '#31748f', yellow: '#f6c177', blue: '#9ccfd8', magenta: '#c4a7e7',
  cyan: '#ebbcba', white: '#e0def4', brightBlack: '#6e6a86', brightRed: '#eb6f92', brightGreen: '#31748f',
  brightYellow: '#f6c177', brightBlue: '#9ccfd8', brightMagenta: '#c4a7e7', brightCyan: '#ebbcba', brightWhite: '#e0def4'
};

const THEME_ROSE_PINE_DAWN = {
  background: '#faf4ed', foreground: '#575279', cursor: '#575279', cursorAccent: '#faf4ed', selection: '#dfdad9',
  black: '#f2e9e1', red: '#b4637a', green: '#286983', yellow: '#ea9d34', blue: '#56949f', magenta: '#907aa9',
  cyan: '#d7827e', white: '#575279', brightBlack: '#9893a5', brightRed: '#b4637a', brightGreen: '#286983',
  brightYellow: '#ea9d34', brightBlue: '#56949f', brightMagenta: '#907aa9', brightCyan: '#d7827e', brightWhite: '#575279'
};

// Official Everforest palette (github.com/sainnhe/everforest), medium contrast.
const THEME_EVERFOREST_DARK = {
  background: '#2d353b', foreground: '#d3c6aa', cursor: '#d3c6aa', cursorAccent: '#2d353b', selection: '#543a48',
  black: '#343f44', red: '#e67e80', green: '#a7c080', yellow: '#dbbc7f', blue: '#7fbbb3', magenta: '#d699b6',
  cyan: '#83c092', white: '#d3c6aa', brightBlack: '#859289', brightRed: '#e67e80', brightGreen: '#a7c080',
  brightYellow: '#dbbc7f', brightBlue: '#7fbbb3', brightMagenta: '#d699b6', brightCyan: '#83c092', brightWhite: '#fdf6e3'
};

const THEME_EVERFOREST_LIGHT = {
  background: '#fdf6e3', foreground: '#5c6a72', cursor: '#5c6a72', cursorAccent: '#fdf6e3', selection: '#f0eee4',
  black: '#fdf6e3', red: '#f85552', green: '#8da101', yellow: '#dfa000', blue: '#3a94c5', magenta: '#df69ba',
  cyan: '#35a77c', white: '#5c6a72', brightBlack: '#939f91', brightRed: '#f85552', brightGreen: '#8da101',
  brightYellow: '#dfa000', brightBlue: '#3a94c5', brightMagenta: '#df69ba', brightCyan: '#35a77c', brightWhite: '#2f3d44'
};

// Official Nightfox palette (github.com/EdenEast/nightfox.nvim).
const THEME_NIGHTFOX = {
  background: '#192330', foreground: '#cdcecf', cursor: '#cdcecf', cursorAccent: '#192330', selection: '#2b3b51',
  black: '#393b44', red: '#c94f6d', green: '#81b29a', yellow: '#dbc074', blue: '#719cd6', magenta: '#9d79d6',
  cyan: '#63cdcf', white: '#dfdfe0', brightBlack: '#575860', brightRed: '#d16983', brightGreen: '#8ebaa4',
  brightYellow: '#e0c989', brightBlue: '#86abdc', brightMagenta: '#baa1e2', brightCyan: '#7ad5d6', brightWhite: '#e4e4e5'
};

// Nightfox's Duskfox variant - dustier purple/rose take on the same family.
const THEME_DUSKFOX = {
  background: '#232136', foreground: '#e0def4', cursor: '#e0def4', cursorAccent: '#232136', selection: '#393552',
  black: '#2b2a41', red: '#eb6f92', green: '#a3be8c', yellow: '#f6c177', blue: '#569fba', magenta: '#c4a7e7',
  cyan: '#9ccfd8', white: '#e0def4', brightBlack: '#6e6a86', brightRed: '#ea9a97', brightGreen: '#a3be8c',
  brightYellow: '#f6c177', brightBlue: '#569fba', brightMagenta: '#c4a7e7', brightCyan: '#9ccfd8', brightWhite: '#f9f9f9'
};

// Official Ayu Dark palette (github.com/ayu-theme/ayu-colors).
const THEME_AYU_DARK = {
  background: '#0a0e14', foreground: '#b3b1ad', cursor: '#e6b450', cursorAccent: '#0a0e14', selection: '#273747',
  black: '#01060e', red: '#ea6c73', green: '#91b362', yellow: '#f9af4f', blue: '#53bdfa', magenta: '#d2a6ff',
  cyan: '#90e1c6', white: '#c7c7c7', brightBlack: '#686868', brightRed: '#f07178', brightGreen: '#c2d94c',
  brightYellow: '#ffb454', brightBlue: '#59c2ff', brightMagenta: '#d2a6ff', brightCyan: '#95e6cb', brightWhite: '#ffffff'
};

const THEME_AYU_LIGHT = {
  background: '#fafafa', foreground: '#5c6166', cursor: '#ff9940', cursorAccent: '#fafafa', selection: '#d1d1d1',
  black: '#f8f9fa', red: '#f51818', green: '#86b300', yellow: '#f2ae49', blue: '#399ee6', magenta: '#a37acc',
  cyan: '#4cbf99', white: '#5c6166', brightBlack: '#abb0b6', brightRed: '#ff7383', brightGreen: '#b8e532',
  brightYellow: '#ffd173', brightBlue: '#73d8ff', brightMagenta: '#dabafa', brightCyan: '#7ff1cb', brightWhite: '#000000'
};

// Standard "Material Ocean" terminal palette (from the popular Material Theme family).
const THEME_MATERIAL_OCEAN = {
  background: '#0f111a', foreground: '#a6accd', cursor: '#a6accd', cursorAccent: '#0f111a', selection: '#464b5d',
  black: '#464b5d', red: '#ff5370', green: '#c3e88d', yellow: '#ffcb6b', blue: '#82aaff', magenta: '#c792ea',
  cyan: '#89ddff', white: '#ffffff', brightBlack: '#69708a', brightRed: '#ff5370', brightGreen: '#c3e88d',
  brightYellow: '#ffcb6b', brightBlue: '#82aaff', brightMagenta: '#c792ea', brightCyan: '#89ddff', brightWhite: '#ffffff'
};

// GitHub's own dark/light UI terminal palettes (primer.style / github.com dark & light default).
const THEME_GITHUB_DARK = {
  background: '#0d1117', foreground: '#c9d1d9', cursor: '#c9d1d9', cursorAccent: '#0d1117', selection: '#1c3a5e',
  black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922', blue: '#58a6ff', magenta: '#bc8cff',
  cyan: '#39c5cf', white: '#b1bac4', brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
  brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff', brightCyan: '#56d4dd', brightWhite: '#f0f6fc'
};

const THEME_GITHUB_LIGHT = {
  background: '#ffffff', foreground: '#1f2328', cursor: '#1f2328', cursorAccent: '#ffffff', selection: '#b6e3ff',
  black: '#24292f', red: '#cf222e', green: '#1a7f37', yellow: '#9a6700', blue: '#0969da', magenta: '#8250df',
  cyan: '#1b7c83', white: '#6e7781', brightBlack: '#57606a', brightRed: '#a40e26', brightGreen: '#2da44e',
  brightYellow: '#bf8700', brightBlue: '#218bff', brightMagenta: '#a475f9', brightCyan: '#3192aa', brightWhite: '#8c959f'
};

// SynthWave '84 - the archetypal "riced" neon retrowave theme (signature magenta/cyan glow).
const THEME_SYNTHWAVE84 = {
  background: '#2a2139', foreground: '#f4eee4', cursor: '#f4eee4', cursorAccent: '#2a2139', selection: '#34294f',
  black: '#241b2f', red: '#fe4450', green: '#72f1b8', yellow: '#fede5d', blue: '#03edf9', magenta: '#ff7edb',
  cyan: '#36f9f6', white: '#f4eee4', brightBlack: '#848bbd', brightRed: '#fe4450', brightGreen: '#72f1b8',
  brightYellow: '#fede5d', brightBlue: '#03edf9', brightMagenta: '#ff7edb', brightCyan: '#36f9f6', brightWhite: '#ffffff'
};

// Sonokai "default" style (github.com/sainnhe/sonokai) - high-contrast Monokai Pro derivative.
const THEME_SONOKAI = {
  background: '#2c2e34', foreground: '#e2e2e3', cursor: '#e2e2e3', cursorAccent: '#2c2e34', selection: '#414550',
  black: '#181819', red: '#fc5d7c', green: '#9ed072', yellow: '#e7c664', blue: '#76cce0', magenta: '#b39df3',
  cyan: '#85d3f2', white: '#e2e2e3', brightBlack: '#7f8490', brightRed: '#fc5d7c', brightGreen: '#9ed072',
  brightYellow: '#e7c664', brightBlue: '#76cce0', brightMagenta: '#b39df3', brightCyan: '#85d3f2', brightWhite: '#f3f3f3'
};

// Standard Solarized palette, dark variant (companion to THEME_SOLARIZED_LIGHT above).
const THEME_SOLARIZED_DARK = {
  background: '#002b36', foreground: '#839496', cursor: '#839496', cursorAccent: '#002b36', selection: '#073642',
  black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', magenta: '#d33682',
  cyan: '#2aa198', white: '#eee8d5', brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75',
  brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3'
};

const XTERM_THEMES: Record<AppTheme, typeof THEME_DARK> = {
  dark: THEME_DARK,
  light: THEME_LIGHT,
  dracula: THEME_DRACULA,
  nord: THEME_NORD,
  'solarized-light': THEME_SOLARIZED_LIGHT,
  'one-dark': THEME_ONE_DARK,
  monokai: THEME_MONOKAI,
  'catppuccin-mocha': THEME_CATPPUCCIN_MOCHA,
  'catppuccin-latte': THEME_CATPPUCCIN_LATTE,
  tokyonight: THEME_TOKYONIGHT,
  'tokyonight-storm': THEME_TOKYONIGHT_STORM,
  'tokyonight-day': THEME_TOKYONIGHT_DAY,
  'gruvbox-dark': THEME_GRUVBOX_DARK,
  'gruvbox-light': THEME_GRUVBOX_LIGHT,
  kanagawa: THEME_KANAGAWA,
  'rose-pine': THEME_ROSE_PINE,
  'rose-pine-dawn': THEME_ROSE_PINE_DAWN,
  'everforest-dark': THEME_EVERFOREST_DARK,
  'everforest-light': THEME_EVERFOREST_LIGHT,
  nightfox: THEME_NIGHTFOX,
  duskfox: THEME_DUSKFOX,
  'ayu-dark': THEME_AYU_DARK,
  'ayu-light': THEME_AYU_LIGHT,
  'material-ocean': THEME_MATERIAL_OCEAN,
  'github-dark': THEME_GITHUB_DARK,
  'github-light': THEME_GITHUB_LIGHT,
  synthwave84: THEME_SYNTHWAVE84,
  sonokai: THEME_SONOKAI,
  'solarized-dark': THEME_SOLARIZED_DARK
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
        this.term.setOption('fontFamily', fontStackFor(TERMINAL_FONT_OPTIONS, settings.terminalFontFamily));
        this.term.setOption('theme', XTERM_THEMES[settings.theme]);
        if (this.fitAddon) safeFit(this.fitAddon);
      }
    });
  }

  background(): string {
    return XTERM_THEMES[this.state.settings().theme].background;
  }

  ngAfterViewInit(): void {
    const container = this.hostRef.nativeElement;
    const settings = this.state.settings();

    const term = new Terminal({
      fontSize: settings.fontSize,
      fontFamily: fontStackFor(TERMINAL_FONT_OPTIONS, settings.terminalFontFamily),
      theme: XTERM_THEMES[settings.theme],
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
