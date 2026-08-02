import { AppTheme } from './models';

export interface ThemeOption {
  id: AppTheme;
  label: string;
  bg: string;
  panel: string;
  accent: string;
  text: string;
  dark: boolean;
}

// Swatch preview colors mirror each theme's actual CSS variables in styles.css -
// kept in sync by hand since a settings-time preview can't read another theme's
// custom properties without switching to it first. Shared between the Settings modal
// and the first-run onboarding wizard so both list exactly the same themes.
export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'dark', label: 'Dark', bg: '#1c1c1e', panel: '#2a2a2e', accent: '#22b98a', text: '#e8e8ea', dark: true },
  { id: 'dracula', label: 'Dracula', bg: '#282a36', panel: '#363848', accent: '#bd93f9', text: '#f8f8f2', dark: true },
  { id: 'nord', label: 'Nord', bg: '#2e3440', panel: '#3b4252', accent: '#88c0d0', text: '#e5e9f0', dark: true },
  { id: 'one-dark', label: 'One Dark', bg: '#282c34', panel: '#333842', accent: '#61afef', text: '#abb2bf', dark: true },
  { id: 'monokai', label: 'Monokai', bg: '#272822', panel: '#33342c', accent: '#66d9ef', text: '#f8f8f2', dark: true },
  { id: 'solarized-dark', label: 'Solarized Dark', bg: '#002b36', panel: '#0c414e', accent: '#2aa198', text: '#93a1a1', dark: true },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', bg: '#1e1e2e', panel: '#292c3c', accent: '#cba6f7', text: '#cdd6f4', dark: true },
  { id: 'tokyonight', label: 'Tokyo Night', bg: '#1a1b26', panel: '#24283b', accent: '#7aa2f7', text: '#c0caf5', dark: true },
  { id: 'tokyonight-storm', label: 'Tokyo Night Storm', bg: '#24283b', panel: '#2f3449', accent: '#7aa2f7', text: '#c0caf5', dark: true },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark', bg: '#282828', panel: '#323232', accent: '#fe8019', text: '#ebdbb2', dark: true },
  { id: 'kanagawa', label: 'Kanagawa', bg: '#1f1f28', panel: '#2a2a37', accent: '#7e9cd8', text: '#dcd7ba', dark: true },
  { id: 'rose-pine', label: 'Rosé Pine', bg: '#191724', panel: '#26233a', accent: '#c4a7e7', text: '#e0def4', dark: true },
  { id: 'everforest-dark', label: 'Everforest Dark', bg: '#2d353b', panel: '#3a444a', accent: '#a7c080', text: '#d3c6aa', dark: true },
  { id: 'nightfox', label: 'Nightfox', bg: '#192330', panel: '#212d3e', accent: '#719cd6', text: '#cdcecf', dark: true },
  { id: 'duskfox', label: 'Duskfox', bg: '#232136', panel: '#2f2c47', accent: '#c4a7e7', text: '#e0def4', dark: true },
  { id: 'ayu-dark', label: 'Ayu Dark', bg: '#0a0e14', panel: '#131721', accent: '#e6b450', text: '#b3b1ad', dark: true },
  { id: 'material-ocean', label: 'Material Ocean', bg: '#0f111a', panel: '#191c27', accent: '#82aaff', text: '#a6accd', dark: true },
  { id: 'github-dark', label: 'GitHub Dark', bg: '#0d1117', panel: '#1c2129', accent: '#58a6ff', text: '#c9d1d9', dark: true },
  { id: 'synthwave84', label: 'SynthWave ’84', bg: '#262335', panel: '#241b2f', accent: '#ff7edb', text: '#f4eee4', dark: true },
  { id: 'sonokai', label: 'Sonokai', bg: '#2c2e34', panel: '#393b45', accent: '#76cce0', text: '#e2e2e3', dark: true },
  { id: 'light', label: 'Light', bg: '#ffffff', panel: '#f0f2f5', accent: '#006044', text: '#1d2129', dark: false },
  { id: 'solarized-light', label: 'Solarized Light', bg: '#fdf6e3', panel: '#eee8d5', accent: '#268bd2', text: '#073642', dark: false },
  { id: 'catppuccin-latte', label: 'Catppuccin Latte', bg: '#eff1f5', panel: '#dce0e8', accent: '#8839ef', text: '#4c4f69', dark: false },
  { id: 'tokyonight-day', label: 'Tokyo Night Day', bg: '#e1e2e7', panel: '#cbccd1', accent: '#2e7de9', text: '#3760bf', dark: false },
  { id: 'gruvbox-light', label: 'Gruvbox Light', bg: '#fbf1c7', panel: '#f2e5b9', accent: '#af3a03', text: '#3c3836', dark: false },
  { id: 'rose-pine-dawn', label: 'Rosé Pine Dawn', bg: '#faf4ed', panel: '#f2e9e1', accent: '#907aa9', text: '#575279', dark: false },
  { id: 'everforest-light', label: 'Everforest Light', bg: '#fdf6e3', panel: '#f4ebd4', accent: '#8da101', text: '#5c6a72', dark: false },
  { id: 'ayu-light', label: 'Ayu Light', bg: '#fafafa', panel: '#eaebec', accent: '#ff9940', text: '#5c6166', dark: false },
  { id: 'github-light', label: 'GitHub Light', bg: '#ffffff', panel: '#eff2f5', accent: '#0969da', text: '#1f2328', dark: false }
];

export const DARK_THEME_OPTIONS = THEME_OPTIONS.filter((t) => t.dark);
export const LIGHT_THEME_OPTIONS = THEME_OPTIONS.filter((t) => !t.dark);
