export interface FontOption {
  id: string;
  label: string;
  /** Full CSS font-family stack - the chosen font first, with reasonable fallbacks so
   * nothing breaks if it isn't actually installed on the machine this is opened on (no
   * font files are bundled with the app). */
  stack: string;
}

/** App chrome font - toolbar, sidebar, panels, everything except the terminal. Includes
 * a few monospace options for a genuinely "TUI-native" look, not just sans-serif. */
export const UI_FONT_OPTIONS: FontOption[] = [
  {
    id: 'system',
    label: 'System Default',
    stack:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", ' +
      '"Segoe UI", "Helvetica Neue", Roboto, Helvetica, Arial, sans-serif'
  },
  { id: 'inter', label: 'Inter', stack: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: 'ibm-plex-sans', label: 'IBM Plex Sans', stack: '"IBM Plex Sans", -apple-system, "Segoe UI", sans-serif' },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono (monospace UI)',
    stack: '"JetBrains Mono", "JetBrainsMono Nerd Font", ui-monospace, "SFMono-Regular", Consolas, monospace'
  },
  {
    id: 'fira-code',
    label: 'Fira Code (monospace UI)',
    stack: '"Fira Code", "FiraCode Nerd Font", ui-monospace, "SFMono-Regular", Consolas, monospace'
  },
  {
    id: 'cascadia-code',
    label: 'Cascadia Code (monospace UI)',
    stack: '"Cascadia Code", "CaskaydiaCove Nerd Font", ui-monospace, "SFMono-Regular", Consolas, monospace'
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono (monospace UI)',
    stack: '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, monospace'
  },
  {
    id: 'iosevka',
    label: 'Iosevka (monospace UI)',
    stack: '"Iosevka", "Iosevka Nerd Font", ui-monospace, "SFMono-Regular", Consolas, monospace'
  },
  {
    id: 'space-mono',
    label: 'Space Mono (monospace UI)',
    stack: '"Space Mono", ui-monospace, "SFMono-Regular", Consolas, monospace'
  },
  {
    id: 'berkeley-mono',
    label: 'Berkeley Mono (monospace UI)',
    stack: '"Berkeley Mono", ui-monospace, "SFMono-Regular", Consolas, monospace'
  }
];

/** Terminal (xterm.js) font. "Auto" is the long-standing default: a wide nerd-font
 * fallback chain so powerline/prompt glyphs render if the user happens to have any of
 * them installed, without requiring one specifically. */
export const TERMINAL_FONT_OPTIONS: FontOption[] = [
  {
    id: 'auto',
    label: 'Auto (best available Nerd Font)',
    stack:
      '"CaskaydiaCove Nerd Font", "FiraCode Nerd Font Mono", "Hack Nerd Font Mono", ' +
      '"JetBrainsMono Nerd Font Mono", "MesloLGS NF", "Cascadia Code", ui-monospace, ' +
      '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace'
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    stack: '"JetBrains Mono", "JetBrainsMono Nerd Font Mono", ui-monospace, Consolas, monospace'
  },
  { id: 'fira-code', label: 'Fira Code', stack: '"Fira Code", "FiraCode Nerd Font Mono", ui-monospace, Consolas, monospace' },
  {
    id: 'cascadia-code',
    label: 'Cascadia Code',
    stack: '"Cascadia Code", "CaskaydiaCove Nerd Font", ui-monospace, Consolas, monospace'
  },
  { id: 'ibm-plex-mono', label: 'IBM Plex Mono', stack: '"IBM Plex Mono", ui-monospace, Consolas, monospace' },
  { id: 'iosevka', label: 'Iosevka', stack: '"Iosevka", "Iosevka Nerd Font Mono", ui-monospace, Consolas, monospace' },
  { id: 'hack', label: 'Hack', stack: '"Hack", "Hack Nerd Font Mono", ui-monospace, Consolas, monospace' },
  { id: 'source-code-pro', label: 'Source Code Pro', stack: '"Source Code Pro", ui-monospace, Consolas, monospace' },
  { id: 'victor-mono', label: 'Victor Mono', stack: '"Victor Mono", ui-monospace, Consolas, monospace' },
  {
    id: 'system-mono',
    label: 'System Monospace',
    stack: 'ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace'
  }
];

export function fontStackFor(options: FontOption[], id: string): string {
  return options.find((o) => o.id === id)?.stack ?? options[0].stack;
}
