import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ModalComponent } from '../shared/modal.component';
import { IconComponent, IconName } from '../shared/icon.component';
import { AppearancePreviewComponent } from '../shared/appearance-preview.component';
import { ApiService } from '../core/api.service';
import { AppStateService } from '../core/app-state.service';
import { AppSettings } from '../core/models';
import { UI_FONT_OPTIONS, TERMINAL_FONT_OPTIONS } from '../core/font-catalog';
import { DARK_THEME_OPTIONS, LIGHT_THEME_OPTIONS } from '../core/theme-catalog';

type SettingsTab = 'appearance' | 'typography' | 'connection' | 'tabs' | 'data';

interface TabDef {
  id: SettingsTab;
  label: string;
  icon: IconName;
}

const TABS: TabDef[] = [
  { id: 'appearance', label: 'Appearance', icon: 'settings' },
  { id: 'typography', label: 'Typography', icon: 'edit' },
  { id: 'connection', label: 'Connection', icon: 'plug' },
  { id: 'tabs', label: 'Tabs & Uploads', icon: 'terminal' },
  { id: 'data', label: 'Data & History', icon: 'history' }
];

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent, AppearancePreviewComponent],
  template: `
    <app-modal title="Settings" [width]="860" (close)="close.emit()">
      <div class="settings-shell" [class.settings-shell-with-preview]="showPreview()">
        <nav class="settings-nav">
          @for (t of tabs; track t.id) {
            <button
              type="button"
              class="settings-nav-item"
              [class.settings-nav-item-active]="activeTab === t.id"
              (click)="activeTab = t.id"
            >
              <app-icon [name]="t.icon" size="15" />
              {{ t.label }}
            </button>
          }
        </nav>

        <div class="settings-panel">
          @switch (activeTab) {
            @case ('appearance') {
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
            }
            @case ('typography') {
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

              <label class="form-field">
                <span>UI scale — {{ form.uiScalePercent }}%</span>
                <input type="range" min="70" max="120" step="5" [(ngModel)]="form.uiScalePercent" />
              </label>

              <p class="settings-section-hint">
                Font choices need to actually be installed on this machine to render - nothing is bundled with
                the app, so an unavailable font falls back to the next one in its stack automatically.
              </p>
            }
            @case ('connection') {
              <label class="form-field form-field-row">
                <span>Auto-reconnect on unexpected drop</span>
                <input type="checkbox" [(ngModel)]="form.autoReconnect" />
              </label>

              <div class="form-field-row-group">
                <label class="form-field">
                  <span>Reconnect interval (seconds)</span>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    [(ngModel)]="form.reconnectIntervalSeconds"
                    [disabled]="!form.autoReconnect"
                  />
                </label>
                <label class="form-field">
                  <span>Max reconnect attempts</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    [(ngModel)]="form.maxReconnectAttempts"
                    [disabled]="!form.autoReconnect"
                  />
                </label>
              </div>
            }
            @case ('tabs') {
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
            }
            @case ('data') {
              <p class="settings-section-hint">
                Recent searches and past run commands are stored locally so they survive reconnects - clear them
                here if needed.
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

              <div class="settings-field-label" style="margin-top: 10px;">First-time setup</div>
              <button class="btn" type="button" (click)="replayOnboarding.emit()">
                <app-icon name="refresh" size="13" />
                Replay the first-time setup wizard
              </button>
            }
          }
        </div>

        @if (showPreview()) {
          <aside class="settings-preview">
            <div class="settings-preview-label">Live preview</div>
            <app-appearance-preview
              [theme]="form.theme"
              [uiFontFamily]="form.uiFontFamily"
              [lineHeight]="form.uiLineHeight"
            ></app-appearance-preview>
          </aside>
        }
      </div>

      @if (error) {
        <div class="form-error">{{ error }}</div>
      }

      <div class="form-actions">
        <button class="btn" type="button" (click)="close.emit()">Cancel</button>
        <button class="btn btn-primary" type="button" [disabled]="saving" (click)="save()">Save</button>
      </div>
    </app-modal>
  `,
  styles: [`
    .settings-shell {
      display: grid;
      grid-template-columns: 168px 1fr;
      gap: 18px;
      min-height: 420px;
    }
    .settings-shell-with-preview {
      grid-template-columns: 168px 1fr 220px;
    }
    .settings-nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      border-right: 1px solid var(--border);
      padding-right: 14px;
    }
    .settings-nav-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      color: var(--text-dim);
      font-weight: 500;
      text-align: left;
      background: transparent;
      transition: background 0.15s ease, color 0.12s ease, transform 0.25s var(--ease-spring);
    }
    .settings-nav-item:hover { background: var(--bg-hover); color: var(--text); }
    .settings-nav-item-active {
      background: var(--bg-selected);
      color: var(--bg-selected-text);
      transform: translateX(2px);
    }
    .settings-panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }
    .settings-preview {
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: sticky;
      top: 0;
      height: fit-content;
    }
    .settings-preview-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
    }
    app-appearance-preview {
      display: block;
      height: 210px;
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
      grid-template-columns: repeat(auto-fill, minmax(126px, 1fr));
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
      transition: border-color 0.12s ease, transform 0.3s var(--ease-spring);
    }
    .theme-swatch:hover { border-color: var(--border-strong); transform: translateY(-1px); }
    .theme-swatch-active {
      border-color: var(--accent);
      animation: swatch-pop 0.4s var(--ease-bounce);
    }
    @keyframes swatch-pop {
      0% { transform: scale(0.94); }
      60% { transform: scale(1.035); }
      100% { transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .theme-swatch-active { animation: none; }
    }
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
  /** Lets the caller re-open the first-run onboarding wizard on demand, rather than only
   * ever seeing it once on the very first launch. */
  @Output() replayOnboarding = new EventEmitter<void>();

  form!: AppSettings;
  saving = false;
  error: string | null = null;
  clearing: 'stage' | 'commands' | null = null;
  historyMessage: string | null = null;
  activeTab: SettingsTab = 'appearance';

  readonly tabs = TABS;
  readonly darkThemes = DARK_THEME_OPTIONS;
  readonly lightThemes = LIGHT_THEME_OPTIONS;
  readonly uiFontOptions = UI_FONT_OPTIONS;
  readonly terminalFontOptions = TERMINAL_FONT_OPTIONS;

  constructor(private state: AppStateService, private api: ApiService) {}

  ngOnInit(): void {
    this.form = { ...this.state.settings() };
  }

  showPreview(): boolean {
    return this.activeTab === 'appearance' || this.activeTab === 'typography';
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
