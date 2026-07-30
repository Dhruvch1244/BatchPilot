import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { QuickExecuteResult, S3FileType } from '../core/models';
import { IconComponent } from '../shared/icon.component';

function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-s3-transfer-panel',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="s3-transfer-panel">
      <div class="form">
        <label class="form-field">
          <span>Vendor</span>
          <input
            list="vendor-options"
            [(ngModel)]="vendorName"
            placeholder="e.g. bloomberg"
            (change)="onVendorChange()"
          />
          <datalist id="vendor-options">
            @for (v of vendors; track v) {
              <option [value]="v"></option>
            }
          </datalist>
        </label>

        @if (vendors.length > 0) {
          <div class="vendor-chip-row">
            @for (v of vendors; track v) {
              <span class="stage-history-chip-static">
                {{ v }}
                <button type="button" class="vendor-remove-btn" title="Remove saved vendor" (click)="removeVendor(v)">
                  <app-icon name="close" size="11" />
                </button>
              </span>
            }
          </div>
        }

        <label class="form-field">
          <span>File name</span>
          <input [(ngModel)]="fileName" placeholder="e.g. positions_report" />
        </label>

        <div class="form-field-row-group">
          <label class="form-field">
            <span>File type</span>
            <select [(ngModel)]="fileType">
              <option value="out">out</option>
              <option value="dif">dif</option>
              <option value="px">px</option>
            </select>
          </label>

          <label class="form-field">
            <span>Date</span>
            <input type="date" [(ngModel)]="date" />
          </label>
        </div>

        <label class="form-field">
          <span>Extra arguments (optional)</span>
          <input [(ngModel)]="extraArgs" placeholder="e.g. a destination path or flags" />
        </label>

        <div class="form-field">
          <span>Command preview</span>
          <code class="s3-command-preview">{{ commandPreview() }}</code>
        </div>

        <button class="btn btn-primary" type="button" [disabled]="running || !canRun()" (click)="run()">
          <app-icon name="play" size="14" />
          {{ running ? 'Running…' : 'Run' }}
        </button>

        @if (error) {
          <div class="form-error">{{ error }}</div>
        }

        @if (result) {
          <div class="quick-execute-result">
            <div class="quick-execute-result-header">
              <span class="status-badge" [class]="result.success ? 'status-success' : 'status-failure'">
                {{ result.success ? 'SUCCESS' : 'EXIT ' + result.exitCode }}
              </span>
              <span class="quick-execute-duration">{{ result.durationMs }} ms</span>
            </div>
            <div class="quick-execute-command">$ {{ result.command }}</div>
            @if (result.stdout) {
              <pre class="quick-execute-output quick-execute-stdout">{{ result.stdout }}</pre>
            }
            @if (result.stderr) {
              <pre class="quick-execute-output quick-execute-stderr">{{ result.stderr }}</pre>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .s3-transfer-panel { flex: 1; overflow-y: auto; padding: 20px; max-width: 560px; }
    .form-field-row-group { display: flex; gap: 12px; }
    .form-field-row-group .form-field { flex: 1; }
    .s3-command-preview {
      display: block;
      background: var(--bg-panel-alt);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px 10px;
      font-size: 11.5px;
      word-break: break-all;
      color: var(--accent);
    }
    .vendor-chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: -6px; }
    .stage-history-chip-static {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--text-dim);
      background: var(--bg-panel-alt);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 3px 6px 3px 10px;
    }
    .vendor-remove-btn {
      display: inline-flex;
      background: transparent;
      border: none;
      color: var(--text-dim);
      padding: 2px;
      border-radius: 50%;
      cursor: pointer;
    }
    .vendor-remove-btn:hover { background: var(--bg-hover); color: var(--error); }
  `]
})
export class S3TransferPanelComponent implements OnInit {
  @Input({ required: true }) environmentId!: string;

  vendors: string[] = [];
  vendorName = '';
  fileName = '';
  fileType: S3FileType = 'out';
  date = todayIso();
  extraArgs = '';
  running = false;
  error: string | null = null;
  result: QuickExecuteResult | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadVendors();
  }

  async loadVendors(): Promise<void> {
    try {
      this.vendors = await firstValueFrom(this.api.listVendors());
    } catch {
      // Non-fatal: vendor suggestions are a convenience.
    }
  }

  onVendorChange(): void {
    // Persistence happens server-side on a successful run; nothing to do here.
  }

  async removeVendor(name: string): Promise<void> {
    try {
      this.vendors = await firstValueFrom(this.api.removeVendor(name));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to remove vendor';
    }
  }

  canRun(): boolean {
    return !!this.vendorName.trim() && !!this.fileName.trim() && !!this.fileType && !!this.date;
  }

  commandPreview(): string {
    const vendor = this.vendorName.trim() || '<vendor_name>';
    const file = this.fileName.trim() || '<fileName>';
    const dateSuffix = this.date ? this.date.replace(/-/g, '') : 'YYYYMMDD';
    const extra = this.extraArgs.trim();
    return `aws s3 cp s3://$S3_BUCKET/daaf-staging/${vendor}/${file}.${this.fileType}.${dateSuffix}${extra ? ' ' + extra : ''}`;
  }

  async run(): Promise<void> {
    if (!this.canRun()) return;
    this.running = true;
    this.error = null;
    try {
      this.result = await firstValueFrom(
        this.api.runS3Transfer(this.environmentId, {
          vendorName: this.vendorName.trim(),
          fileName: this.fileName.trim(),
          fileType: this.fileType,
          date: this.date,
          extraArgs: this.extraArgs.trim() || undefined
        })
      );
      await this.loadVendors();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Transfer failed';
    } finally {
      this.running = false;
    }
  }
}
