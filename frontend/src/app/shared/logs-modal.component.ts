import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ModalComponent } from './modal.component';
import { IconComponent } from './icon.component';

type Preset = 'all' | 'errors' | 'warnings' | 'custom';

const SIZE_OPTIONS = [
  { label: 'Last 500 MB', mb: 500 },
  { label: 'Last 1 GB', mb: 1024 },
  { label: 'Last 2 GB', mb: 2048 },
  { label: 'Last 5 GB', mb: 5120 }
];

// Classified in this order - a line matching more than one (rare) gets the first,
// most-severe match. Word-boundary matched so e.g. "warehouse" doesn't read as WARN.
const ERROR_PATTERN = /\b(ERROR|FATAL|EXCEPTION|SEVERE)\b/i;
const WARN_PATTERN = /\bWARN(ING)?\b/i;
const DEBUG_PATTERN = /\b(DEBUG|TRACE)\b/i;

function classifyLogLine(line: string): string {
  if (ERROR_PATTERN.test(line)) return 'log-line-error';
  if (WARN_PATTERN.test(line)) return 'log-line-warn';
  if (DEBUG_PATTERN.test(line)) return 'log-line-debug';
  return '';
}

@Component({
  selector: 'app-logs-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent, IconComponent],
  template: `
    <app-modal [title]="'Logs — ' + applicationId" [width]="720" (close)="close.emit()">
      <div class="form">
        <div class="logs-filter-row">
          <div class="view-toggle">
            <button type="button" [class.active]="preset === 'all'" (click)="setPreset('all')">All</button>
            <button type="button" [class.active]="preset === 'errors'" (click)="setPreset('errors')">Errors</button>
            <button type="button" [class.active]="preset === 'warnings'" (click)="setPreset('warnings')">Warnings</button>
          </div>
          <input
            class="file-manager-search logs-grep-input"
            placeholder="Custom grep pattern…"
            [(ngModel)]="grep"
            (ngModelChange)="preset = 'custom'"
          />
          <label class="logs-case-toggle">
            <input type="checkbox" [(ngModel)]="caseInsensitive" />
            Aa
          </label>
        </div>

        <div class="logs-filter-row">
          <button class="btn" type="button" [disabled]="loadingPreview" (click)="loadPreview()">
            <app-icon name="refresh" size="14" [spin]="loadingPreview" />
            Refresh preview (last 500 lines)
          </button>
        </div>

        @if (error) {
          <div class="form-error">{{ error }}</div>
        }

        <div class="logs-preview">
          @if (previewLines.length > 0) {
            @for (line of previewLines; track $index) {
              <div class="log-line" [class]="lineClass(line)">{{ line }}</div>
            }
          } @else {
            <div class="log-line log-line-dim">{{ loadingPreview ? 'Loading…' : 'No preview yet — click Refresh.' }}</div>
          }
        </div>

        <div class="logs-filter-row">
          <label class="form-field logs-size-field">
            <span>Download size (from the end of the log)</span>
            <select [(ngModel)]="downloadSizeMb">
              @for (opt of sizeOptions; track opt.mb) {
                <option [value]="opt.mb">{{ opt.label }}</option>
              }
            </select>
          </label>
          <a class="btn btn-primary logs-download-btn" [href]="downloadUrl()" download>
            <app-icon name="download" size="14" />
            Download to Downloads folder
          </a>
        </div>
        <p class="stage-group-label">
          Logs can run past 24 GB — the download only pulls the last selected size (and grep
          filter, if set) directly on the server, streamed straight to your browser's download.
        </p>
      </div>
    </app-modal>
  `,
  styles: [`
    .logs-filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .logs-grep-input { flex: 1; min-width: 160px; padding-left: 10px; }
    .logs-case-toggle { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-dim); cursor: pointer; }
    .logs-preview {
      background: var(--bg-app);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 10px;
      max-height: 320px;
      overflow: auto;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 11.5px;
    }
    .log-line {
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--text);
      line-height: 1.5;
    }
    .log-line-error { color: var(--error); font-weight: 500; }
    .log-line-warn { color: var(--warning); }
    .log-line-debug { color: var(--text-dim); }
    .log-line-dim { color: var(--text-dim); }
    .logs-size-field { flex: 1; }
    .logs-download-btn { align-self: flex-end; text-decoration: none; }
  `]
})
export class LogsModalComponent implements OnInit {
  @Input({ required: true }) environmentId!: string;
  @Input({ required: true }) applicationId!: string;
  @Output() close = new EventEmitter<void>();

  readonly sizeOptions = SIZE_OPTIONS;

  preset: Preset = 'all';
  grep = '';
  caseInsensitive = true;
  downloadSizeMb = 1024;
  previewLines: string[] = [];
  loadingPreview = false;
  error: string | null = null;

  readonly lineClass = classifyLogLine;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadPreview();
  }

  setPreset(preset: Preset): void {
    this.preset = preset;
    this.grep = preset === 'errors' ? 'ERROR' : preset === 'warnings' ? 'WARN' : '';
    this.loadPreview();
  }

  async loadPreview(): Promise<void> {
    this.loadingPreview = true;
    this.error = null;
    try {
      const result = await firstValueFrom(this.api.getYarnLogs(this.environmentId, this.applicationId, 500));
      let text = result.logs;
      if (this.grep.trim()) {
        const flags = this.caseInsensitive ? 'i' : '';
        const pattern = new RegExp(this.escapeRegExp(this.grep.trim()), flags);
        text = text
          .split('\n')
          .filter((line) => pattern.test(line))
          .join('\n');
      }
      this.previewLines = (text || '(no matching lines in the last 500)').split('\n');
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load logs';
    } finally {
      this.loadingPreview = false;
    }
  }

  downloadUrl(): string {
    return this.api.yarnLogsDownloadUrl(
      this.environmentId,
      this.applicationId,
      this.downloadSizeMb,
      this.grep.trim() || undefined,
      this.caseInsensitive
    );
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
