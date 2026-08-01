import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ModalComponent } from '../shared/modal.component';
import { IconComponent } from '../shared/icon.component';
import { ApiService } from '../core/api.service';
import { AppStateService } from '../core/app-state.service';
import { AppSettings, AppTheme } from '../core/models';
import { UI_FONT_OPTIONS, TERMINAL_FONT_OPTIONS } from '../core/font-catalog';

interface ThemeOption {
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
// custom properties without switching to it first.
const THEME_OPTIONS: ThemeOption[] = [
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

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent],
  template: `
    <app-modal title="Settings" [width]="680" (close)="close.emit()">
      <div class="settings-body">
        <section class="settings-section">
          <div class="settings-section-header">
            <app-icon name="settings" size="14" />
            <span>Appearance</span>
          </div>

          <div class="settings-field-label">Dark themes ({{ darkThemes.length }})</div>
          <div class="theme-grid">
            @for (t of darkThemes; track t.id) {
              <button
                type="button"
                class="theme-swatch"
                [class.theme-swatch-active]="form.theme === t.id"
                [style.background]="t.bg"
                [style.color]="t.text"
                (click)="form.theme = t.id"
              >
                <span class="theme-swatch-accent" [style.background]="t.accent"></span>
                <span class="theme-swatch-panel" [style.background]="t.panel"></span>
                <span class="theme-swatch-label">{{ t.label }}</span>
                @if (form.theme === t.id) {
                  <span class="theme-swatch-check"><app-icon name="check-circle" size="14" /></span>
                }
              </button>
            }
          </div>

          <div class="settings-field-label">Light themes ({{ lightThemes.length }})</div>
          <div class="theme-grid">
            @for (t of lightThemes; track t.id) {
              <button
                type="button"
                class="theme-swatch"
                [class.theme-swatch-active]="form.theme === t.id"
                [style.background]="t.bg"
                [style.color]="t.text"
                (click)="form.theme = t.id"
              >
                <span class="theme-swatch-accent" [style.background]="t.accent"></span>
                <span class="theme-swatch-panel" [style.background]="t.panel"></span>
                <span class="theme-swatch-label">{{ t.label }}</span>
                @if (form.theme === t.id) {
                  <span class="theme-swatch-check"><app-icon name="check-circle" size="14" /></span>
                }
              </button>
            }
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section-header">
            <app-icon name="edit" size="14" />
            <span>Typography</span>
          </div>

          <div class="form-field-row-group">
            <label class="form-field">
              <span>UI font</span>
              <select [(ngModel)]="form.uiFontFamily">
                @for (f of uiFontOptions; track f.id) {
                  <option [value]="f.id">{{ f.label }}</option>
                }
              </select>
            </label>
            <label class="form-field">
              <span>Terminal font</span>
              <select [(ngModel)]="form.terminalFontFamily">
                @for (f of terminalFontOptions; track f.id) {
                  <option [value]="f.id">{{ f.label }}</option>
                }
              </select>
            </label>
          </div>

          <div class="form-field-row-group">
            <label class="form-field">
              <span>UI font size (px)</span>
              <input type="number" min="10" max="20" [(ngModel)]="form.uiFontSizePx" />
            </label>
            <label class="form-field">
              <span>UI line height</span>
              <input type="number" min="1.1" max="2" step="0.05" [(ngModel)]="form.uiLineHeight" />
            </label>
            <label class="form-field">
              <span>Terminal font size (px)</span>
              <input type="number" min="8" max="32" [(ngModel)]="form.fontSize" />
            </label>
          </div>
          <p class="settings-section-hint">
            Font choices need to actually be installed on this machine to render - nothing is bundled with the
            app, so an unavailable font falls back to the next one in its stack automatically.
          </p>
        </section>

        <section class="settings-section">
          <div class="settings-section-header">
            <app-icon name="plug" size="14" />
            <span>Connection</span>
          </div>

          <label class="form-field form-field-row">
            <span>Auto-reconnect on unexpected drop</span>
            <input type="checkbox" [(ngModel)]="form.autoReconnect" />
          </label>

          <div class="form-field-row-group">
            <label class="form-field">
              <span>Reconnect interval (seconds)</span>
              <input type="number" min="1" max="120" [(ngModel)]="form.reconnectIntervalSeconds" [disabled]="!form.autoReconnect" />
            </label>
            <label class="form-field">
              <span>Max reconnect attempts</span>
              <input type="number" min="1" max="50" [(ngModel)]="form.maxReconnectAttempts" [disabled]="!form.autoReconnect" />
            </label>
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section-header">
            <app-icon name="terminal" size="14" />
            <span>Tabs &amp; uploads</span>
          </div>

          <div class="form-field-row-group">
            <label class="form-field">
              <span>Max terminal tabs</span>
              <input type="number" min="1" max="50" [(ngModel)]="form.maxTabs" />
            </label>
            <label class="form-field">
              <span>Max upload size (MB)</span>
              <input type="number" min="1" [(ngModel)]="form.maxUploadSizeMb" />
            </label>
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section-header">
            <app-icon name="history" size="14" />
            <span>Data &amp; history</span>
          </div>
          <p class="settings-section-hint">
            Recent searches and past run commands are stored locally so they survive reconnects - clear them here if needed.
          </p>
          <div class="settings-history-actions">
            <button class="btn" type="button" [disabled]="clearing === 'stage'" (click)="clearStageHistory()">
              <app-icon name="trash" size="13" />
              Clear Stage Tracker history
            </button>
            <button class="btn" type="button" [disabled]="clearing === 'commands'" (click)="clearCommandHistory()">
              <app-icon name="trash" size="13" />
              Clear command history
            </button>
          </div>
          @if (historyMessage) {
            <div class="settings-history-message">{{ historyMessage }}</div>
          }
        </section>

        @if (error) {
          <div class="form-error">{{ error }}</div>
        }

        <div class="form-actions">
          <button class="btn" type="button" (click)="close.emit()">Cancel</button>
          <button class="btn btn-primary" type="button" [disabled]="saving" (click)="save()">Save</button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .settings-body { display: flex; flex-direction: column; gap: 22px; }
    .settings-section { display: flex; flex-direction: column; gap: 12px; }
    .settings-section-header {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .settings-field-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-dim);
    }
    .settings-section-hint {
      margin: -4px 0 0;
      font-size: 12px;
      color: var(--text-dim);
    }
    .theme-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 10px;
    }
    .theme-swatch {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      border: 2px solid var(--border);
      border-radius: var(--radius-md);
      padding: 10px 10px 9px;
      cursor: pointer;
      overflow: hidden;
      text-align: left;
      transition: border-color 0.12s ease, transform 0.05s ease;
    }
    .theme-swatch:hover { border-color: var(--border-strong); }
    .theme-swatch-active { border-color: var(--accent); }
    .theme-swatch-accent {
      display: block;
      width: 22px;
      height: 22px;
      border-radius: 50%;
    }
    .theme-swatch-panel {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 34px;
      height: 22px;
      border-top-left-radius: var(--radius-sm);
      opacity: 0.9;
    }
    .theme-swatch-label { font-size: 12px; font-weight: 600; }
    .theme-swatch-check {
      position: absolute;
      top: 8px;
      right: 8px;
      color: var(--accent);
      filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.6));
    }
    .settings-history-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .settings-history-message { font-size: 12px; color: var(--text-dim); }
  `]
})
export class SettingsModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  form!: AppSettings;
  saving = false;
  error: string | null = null;
  clearing: 'stage' | 'commands' | null = null;
  historyMessage: string | null = null;

  readonly darkThemes = THEME_OPTIONS.filter((t) => t.dark);
  readonly lightThemes = THEME_OPTIONS.filter((t) => !t.dark);
  readonly uiFontOptions = UI_FONT_OPTIONS;
  readonly terminalFontOptions = TERMINAL_FONT_OPTIONS;

  constructor(private state: AppStateService, private api: ApiService) {}

  ngOnInit(): void {
    this.form = { ...this.state.settings() };
  }

  async save(): Promise<void> {
    this.saving = true;
    this.error = null;
    try {
      await this.state.updateSettings(this.form);
      this.close.emit();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      this.saving = false;
    }
  }

  async clearStageHistory(): Promise<void> {
    if (!window.confirm('Clear all Stage Tracker recent searches?')) return;
    this.clearing = 'stage';
    this.historyMessage = null;
    try {
      await firstValueFrom(this.api.clearStageSearchHistory());
      this.historyMessage = 'Stage Tracker history cleared.';
    } catch (e) {
      this.historyMessage = e instanceof Error ? e.message : 'Failed to clear Stage Tracker history';
    } finally {
      this.clearing = null;
    }
  }

  async clearCommandHistory(): Promise<void> {
    if (!window.confirm('Clear all past Quick Execute and S3 Transfer commands?')) return;
    this.clearing = 'commands';
    this.historyMessage = null;
    try {
      await firstValueFrom(this.api.clearCommandHistory());
      this.historyMessage = 'Command history cleared.';
    } catch (e) {
      this.historyMessage = e instanceof Error ? e.message : 'Failed to clear command history';
    } finally {
      this.clearing = null;
    }
  }
}
