import { Component, Input } from '@angular/core';
import { AppTheme } from '../core/models';
import { UI_FONT_OPTIONS, fontStackFor } from '../core/font-catalog';
import { IconComponent } from './icon.component';

/**
 * A miniature, self-contained mock of the app shell (toolbar, sidebar, a feature card,
 * a primary button) that renders whatever theme/font/line-height combination is passed
 * in - including a combination that hasn't been saved yet. This works for free because
 * every theme in styles.css is just a `.theme-*` class defining CSS custom properties;
 * applying that class to this component's own small root (instead of the real app
 * shell) scopes those variables to just this preview, the same mechanism that lets the
 * real app switch themes live. Used by both the Settings modal and the first-run
 * onboarding wizard so "what will this actually look like" never requires committing
 * to a choice first.
 */
@Component({
  selector: 'app-appearance-preview',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="ap-root" [class]="'theme-' + theme" [style.font-family]="fontFamily()" [style.line-height]="lineHeight">
      <div class="ap-toolbar">
        <span class="ap-brand">BP</span>
        <span class="ap-toolbar-btn ap-toolbar-btn-active">Terminal</span>
        <span class="ap-toolbar-btn">Files</span>
        <span class="ap-toolbar-btn">Applications</span>
      </div>
      <div class="ap-body">
        <div class="ap-sidebar">
          <div class="ap-sidebar-item ap-sidebar-item-active">
            <span class="ap-dot"></span>
            Production
          </div>
          <div class="ap-sidebar-item">
            <span class="ap-dot ap-dot-off"></span>
            Staging
          </div>
        </div>
        <div class="ap-main">
          <div class="ap-card">
            <div class="ap-card-icon"><app-icon name="terminal" size="14" /></div>
            <div class="ap-card-title">Terminal</div>
            <div class="ap-card-desc">Full interactive SSH shell.</div>
          </div>
          <button class="ap-primary-btn" type="button">Connect</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ap-root {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: var(--bg-app);
      color: var(--text);
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-md);
      font-size: 12px;
    }
    .ap-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border);
    }
    .ap-brand {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: var(--radius-sm);
      background: var(--accent);
      color: var(--accent-contrast);
      font-weight: 700;
      font-size: 9px;
    }
    .ap-toolbar-btn {
      padding: 5px 9px;
      border-radius: var(--radius-sm);
      color: var(--text-dim);
      font-weight: 500;
    }
    .ap-toolbar-btn-active {
      background: var(--bg-hover);
      color: var(--text);
    }
    .ap-body {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .ap-sidebar {
      width: 92px;
      flex-shrink: 0;
      background: var(--bg-panel);
      border-right: 1px solid var(--border);
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ap-sidebar-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 6px;
      border-radius: var(--radius-sm);
      color: var(--text-dim);
    }
    .ap-sidebar-item-active {
      background: var(--bg-selected);
      color: var(--bg-selected-text);
    }
    .ap-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
      flex-shrink: 0;
    }
    .ap-dot-off {
      background: var(--text-dim);
      opacity: 0.5;
    }
    .ap-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px;
    }
    .ap-card {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 3px;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      padding: 10px;
    }
    .ap-card-icon {
      display: inline-flex;
      width: 22px;
      height: 22px;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--accent) 14%, transparent);
      color: var(--accent);
      margin-bottom: 3px;
    }
    .ap-card-title {
      font-weight: 600;
    }
    .ap-card-desc {
      color: var(--text-dim);
      font-size: 10.5px;
    }
    .ap-primary-btn {
      width: 100%;
      padding: 7px;
      border-radius: var(--radius-sm);
      background: var(--accent);
      color: var(--accent-contrast);
      border: none;
      font-weight: 600;
      box-shadow: var(--shadow-sm);
    }
  `]
})
export class AppearancePreviewComponent {
  @Input({ required: true }) theme!: AppTheme;
  @Input() uiFontFamily = 'system';
  @Input() lineHeight = 1.5;

  fontFamily(): string {
    return fontStackFor(UI_FONT_OPTIONS, this.uiFontFamily);
  }
}
