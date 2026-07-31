import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ModalComponent } from '../shared/modal.component';
import { IconComponent } from '../shared/icon.component';
import { ApiService } from '../core/api.service';
import { AppStateService } from '../core/app-state.service';
import { AppSettings, AppTheme } from '../core/models';

interface ThemeOption {
  id: AppTheme;
  label: string;
  bg: string;
  panel: string;
  accent: string;
  text: string;
}

// Swatch preview colors mirror each theme's actual CSS variables in styles.css -
// kept in sync by hand since a settings-time preview can't read another theme's
// custom properties without switching to it first.
const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Light', bg: '#ffffff', panel: '#f0f2f5', accent: '#006044', text: '#1d2129' },
  { id: 'dark', label: 'Dark', bg: '#1c1c1e', panel: '#2a2a2e', accent: '#22b98a', text: '#e8e8ea' },
  { id: 'dracula', label: 'Dracula', bg: '#282a36', panel: '#363848', accent: '#bd93f9', text: '#f8f8f2' },
  { id: 'nord', label: 'Nord', bg: '#2e3440', panel: '#3b4252', accent: '#88c0d0', text: '#e5e9f0' },
  { id: 'solarized-light', label: 'Solarized Light', bg: '#fdf6e3', panel: '#eee8d5', accent: '#268bd2', text: '#073642' },
  { id: 'one-dark', label: 'One Dark', bg: '#282c34', panel: '#333842', accent: '#61afef', text: '#abb2bf' },
  { id: 'monokai', label: 'Monokai', bg: '#272822', panel: '#33342c', accent: '#66d9ef', text: '#f8f8f2' }
];

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent],
  template: `
    <app-modal title="Settings" [width]="620" (close)="close.emit()">
      <div class="settings-body">
        <section class="settings-section">
          <div class="settings-section-header">
            <app-icon name="settings" size="14" />
            <span>Appearance</span>
          </div>

          <div class="settings-field-label">Theme</div>
          <div class="theme-grid">
            @for (t of themeOptions; track t.id) {
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

          <label class="form-field">
            <span>Font size</span>
            <input type="number" min="8" max="32" [(ngModel)]="form.fontSize" />
          </label>
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

  readonly themeOptions = THEME_OPTIONS;

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
