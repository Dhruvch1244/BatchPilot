import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../shared/modal.component';
import { IconComponent } from '../shared/icon.component';
import { AppearancePreviewComponent } from '../shared/appearance-preview.component';
import { AppStateService } from '../core/app-state.service';
import { AppSettings } from '../core/models';
import { UI_FONT_OPTIONS, TERMINAL_FONT_OPTIONS } from '../core/font-catalog';
import { DARK_THEME_OPTIONS, LIGHT_THEME_OPTIONS } from '../core/theme-catalog';

const STEP_LABELS = ['Theme', 'Typography', 'Defaults', 'Done'];

/**
 * First-run setup wizard: shown once, automatically, the first time BatchPilot has no
 * saved settings yet (see `onboardingCompleted` in AppSettings) - and replayable any
 * time after from Settings -> Data & History. Every choice previews live in the same
 * `AppearancePreviewComponent` the Settings modal uses, so nothing here requires
 * committing blind before seeing it. Skippable at any step - a fresh install works fine
 * on defaults alone, this is a shortcut to a personalized setup, not a gate.
 */
@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent, AppearancePreviewComponent],
  template: `
    <app-modal title="Welcome to BatchPilot" [width]="800" (close)="skip()">
      <div class="onboarding-shell">
        <div class="onboarding-main">
          <div class="onboarding-progress">
            @for (label of stepLabels; track label; let i = $index) {
              <div class="onboarding-step-dot" [class.onboarding-step-dot-active]="i === step" [class.onboarding-step-dot-done]="i < step">
                <span class="onboarding-step-num">{{ i + 1 }}</span>
                <span class="onboarding-step-label">{{ label }}</span>
              </div>
            }
          </div>

          <div class="onboarding-step-body">
            @switch (step) {
              @case (0) {
                <h3>Pick a theme</h3>
                <p class="onboarding-hint">29 themes, from clean and minimal to full neon-riced TUI. Pick whatever you'll want to look at all day — change it later anytime from Settings.</p>

                <div class="settings-field-label">Dark themes</div>
                <div class="theme-grid">
                  @for (t of darkThemes; track t.id) {
                    <button
                      type="button"
                      class="theme-swatch"
                      [class.theme-swatch-active]="draft.theme === t.id"
                      [style.background]="t.bg"
                      [style.color]="t.text"
                      (click)="draft.theme = t.id"
                    >
                      <span class="theme-swatch-accent" [style.background]="t.accent"></span>
                      <span class="theme-swatch-label">{{ t.label }}</span>
                    </button>
                  }
                </div>
                <div class="settings-field-label">Light themes</div>
                <div class="theme-grid">
                  @for (t of lightThemes; track t.id) {
                    <button
                      type="button"
                      class="theme-swatch"
                      [class.theme-swatch-active]="draft.theme === t.id"
                      [style.background]="t.bg"
                      [style.color]="t.text"
                      (click)="draft.theme = t.id"
                    >
                      <span class="theme-swatch-accent" [style.background]="t.accent"></span>
                      <span class="theme-swatch-label">{{ t.label }}</span>
                    </button>
                  }
                </div>
              }
              @case (1) {
                <h3>Typography</h3>
                <p class="onboarding-hint">Pick a UI font (a few monospace options included, for a genuinely terminal-native look) and set the overall density.</p>

                <div class="form-field-row-group">
                  <label class="form-field">
                    <span>UI font</span>
                    <select [(ngModel)]="draft.uiFontFamily">
                      @for (f of uiFontOptions; track f.id) {
                        <option [value]="f.id">{{ f.label }}</option>
                      }
                    </select>
                  </label>
                  <label class="form-field">
                    <span>Terminal font</span>
                    <select [(ngModel)]="draft.terminalFontFamily">
                      @for (f of terminalFontOptions; track f.id) {
                        <option [value]="f.id">{{ f.label }}</option>
                      }
                    </select>
                  </label>
                </div>
                <div class="form-field-row-group">
                  <label class="form-field">
                    <span>UI font size (px)</span>
                    <input type="number" min="10" max="20" [(ngModel)]="draft.uiFontSizePx" />
                  </label>
                  <label class="form-field">
                    <span>Terminal font size (px)</span>
                    <input type="number" min="8" max="32" [(ngModel)]="draft.fontSize" />
                  </label>
                </div>
                <label class="form-field">
                  <span>UI scale — {{ draft.uiScalePercent }}%</span>
                  <input type="range" min="70" max="120" step="5" [(ngModel)]="draft.uiScalePercent" />
                </label>
              }
              @case (2) {
                <h3>A few defaults</h3>
                <p class="onboarding-hint">Sensible out of the box — tweak now or later from Settings.</p>

                <div class="form-field-row-group">
                  <label class="form-field">
                    <span>Max terminal tabs</span>
                    <input type="number" min="1" max="50" [(ngModel)]="draft.maxTabs" />
                  </label>
                  <label class="form-field">
                    <span>Max upload size (MB)</span>
                    <input type="number" min="1" [(ngModel)]="draft.maxUploadSizeMb" />
                  </label>
                </div>
                <label class="form-field form-field-row">
                  <span>Auto-reconnect on unexpected drop</span>
                  <input type="checkbox" [(ngModel)]="draft.autoReconnect" />
                </label>
              }
              @case (3) {
                <div class="onboarding-finish">
                  <app-icon name="check-circle" size="40" />
                  <h3>You're all set</h3>
                  <p class="onboarding-hint">Everything above is saved and changeable anytime from the gear icon in the toolbar. Next: add your first environment.</p>
                </div>
              }
            }
          </div>

          <div class="onboarding-actions">
            <button class="btn" type="button" (click)="skip()">Skip setup</button>
            <div class="onboarding-actions-right">
              @if (step > 0) {
                <button class="btn" type="button" (click)="back()">Back</button>
              }
              @if (step < stepLabels.length - 1) {
                <button class="btn btn-primary" type="button" (click)="next()">Continue</button>
              } @else {
                <button class="btn btn-primary" type="button" [disabled]="finishing" (click)="finish()">Get started</button>
              }
            </div>
          </div>
        </div>

        <aside class="onboarding-preview">
          <div class="settings-preview-label">Live preview</div>
          <app-appearance-preview
            [theme]="draft.theme"
            [uiFontFamily]="draft.uiFontFamily"
            [lineHeight]="draft.uiLineHeight"
          ></app-appearance-preview>
        </aside>
      </div>
    </app-modal>
  `,
  styles: [`
    .onboarding-shell {
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 20px;
      min-height: 440px;
    }
    .onboarding-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .onboarding-progress {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .onboarding-step-dot {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      padding: 6px 8px;
      border-radius: var(--radius-sm);
      color: var(--text-dim);
      font-size: 11px;
      font-weight: 600;
      border-bottom: 2px solid var(--border);
      transition: border-color 0.25s var(--ease-spring), color 0.2s ease;
    }
    .onboarding-step-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--bg-hover);
      font-size: 10px;
      flex-shrink: 0;
    }
    .onboarding-step-dot-active {
      color: var(--text);
      border-color: var(--accent);
    }
    .onboarding-step-dot-active .onboarding-step-num {
      background: var(--accent);
      color: var(--accent-contrast);
    }
    .onboarding-step-dot-done {
      color: var(--accent);
      border-color: var(--accent);
    }
    .onboarding-step-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      animation: onboarding-step-in 0.35s var(--ease-spring);
    }
    @keyframes onboarding-step-in {
      from { opacity: 0; transform: translateX(8px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .onboarding-step-body { animation: none; }
    }
    .onboarding-step-body h3 { margin: 0; }
    .onboarding-hint {
      margin: 0;
      font-size: 12.5px;
      color: var(--text-dim);
    }
    .onboarding-finish {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 8px;
      flex: 1;
      color: var(--success);
      padding: 30px 10px;
    }
    .onboarding-finish h3 { color: var(--text); }
    .onboarding-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    .onboarding-actions-right { display: flex; gap: 8px; }
    .onboarding-preview {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: fit-content;
    }
    .settings-preview-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
    }
    app-appearance-preview { display: block; height: 220px; }
    .settings-field-label { font-size: 12px; font-weight: 500; color: var(--text-dim); }
    .theme-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 8px;
      margin-bottom: 8px;
    }
    .theme-swatch {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
      border: 2px solid var(--border);
      border-radius: var(--radius-md);
      padding: 8px 8px 7px;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.12s ease, transform 0.3s var(--ease-spring);
    }
    .theme-swatch:hover { border-color: var(--border-strong); transform: translateY(-1px); }
    .theme-swatch-active { border-color: var(--accent); animation: swatch-pop 0.4s var(--ease-bounce); }
    @keyframes swatch-pop {
      0% { transform: scale(0.94); }
      60% { transform: scale(1.035); }
      100% { transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .theme-swatch-active { animation: none; }
    }
    .theme-swatch-accent { display: block; width: 18px; height: 18px; border-radius: 50%; }
    .theme-swatch-label { font-size: 11px; font-weight: 600; }
  `]
})
export class OnboardingWizardComponent implements OnInit {
  /** Prefilled from current settings by the caller (already-persisted defaults, or
   * DEFAULT_SETTINGS for a genuinely first-ever launch). */
  @Input({ required: true }) initial!: AppSettings;
  @Output() done = new EventEmitter<void>();

  step = 0;
  finishing = false;
  draft!: AppSettings;

  readonly stepLabels = STEP_LABELS;
  readonly darkThemes = DARK_THEME_OPTIONS;
  readonly lightThemes = LIGHT_THEME_OPTIONS;
  readonly uiFontOptions = UI_FONT_OPTIONS;
  readonly terminalFontOptions = TERMINAL_FONT_OPTIONS;

  constructor(private state: AppStateService) {}

  ngOnInit(): void {
    this.draft = { ...this.initial };
  }

  next(): void {
    this.step = Math.min(this.step + 1, this.stepLabels.length - 1);
  }

  back(): void {
    this.step = Math.max(this.step - 1, 0);
  }

  async finish(): Promise<void> {
    this.finishing = true;
    try {
      await this.state.updateSettings({ ...this.draft, onboardingCompleted: true });
    } finally {
      this.finishing = false;
      this.done.emit();
    }
  }

  /** Skipping still marks onboarding as seen (so it doesn't reappear on every launch)
   * but discards any in-progress draft changes rather than saving a half-finished
   * setup - only "Get started" actually commits the wizard's choices. */
  async skip(): Promise<void> {
    await this.state.updateSettings({ ...this.initial, onboardingCompleted: true });
    this.done.emit();
  }
}
