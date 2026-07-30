import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AppStateService } from '../core/app-state.service';
import { QuickExecuteResult } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';

@Component({
  selector: 'app-quick-execute-panel',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent],
  template: `
    <app-modal title="Quick Execute" [width]="600" (close)="close.emit()">
      <div class="form">
        <label class="form-field">
          <span>Environment</span>
          <select [(ngModel)]="targetId">
            <option value="" disabled>Select a connected environment</option>
            @for (env of connectedEnvironments(); track env.id) {
              <option [value]="env.id">{{ env.name }}</option>
            }
          </select>
        </label>

        <label class="form-field">
          <span>Command</span>
          <textarea
            [(ngModel)]="command"
            placeholder="e.g. df -h"
            rows="3"
            (keydown)="onKeydown($event)"
          ></textarea>
        </label>

        <button class="btn btn-primary" [disabled]="running || !targetId || !command.trim()" (click)="run()">
          <app-icon name="play" size="14" />
          {{ running ? 'Running…' : 'Run (Ctrl/Cmd+Enter)' }}
        </button>

        @if (error) {
          <div class="form-error">{{ error }}</div>
        }

        <div class="quick-execute-history">
          @for (result of history; track $index) {
            <div class="quick-execute-result">
              <div class="quick-execute-result-header">
                <span class="status-badge" [class]="result.success ? 'status-success' : 'status-failure'">
                  {{ result.success ? 'SUCCESS' : 'EXIT ' + result.exitCode }}
                </span>
                <span class="quick-execute-duration">{{ result.durationMs }} ms</span>
                <div class="quick-execute-result-actions">
                  <button class="icon-btn" type="button" title="Copy output" (click)="copyOutput(result)"><app-icon name="duplicate" size="14" /></button>
                  <button class="icon-btn" type="button" title="Download output" (click)="downloadOutput(result)">
                    <app-icon name="download" size="14" />
                  </button>
                </div>
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
    </app-modal>
  `
})
export class QuickExecutePanelComponent implements OnInit {
  @Input() environmentId: string | null = null;
  @Output() close = new EventEmitter<void>();

  targetId = '';
  command = '';
  running = false;
  error: string | null = null;
  history: QuickExecuteResult[] = [];

  constructor(private api: ApiService, public state: AppStateService) {}

  ngOnInit(): void {
    this.targetId = this.environmentId ?? this.connectedEnvironments()[0]?.id ?? '';
  }

  connectedEnvironments() {
    return this.state.environments().filter((e) => this.state.statuses()[e.id]?.state === 'CONNECTED');
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.run();
    }
  }

  async run(): Promise<void> {
    if (!this.targetId || !this.command.trim()) return;
    this.running = true;
    this.error = null;
    try {
      const result = await firstValueFrom(this.api.runQuickExecute(this.targetId, this.command));
      this.history = [result, ...this.history].slice(0, 20);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Command failed to execute';
    } finally {
      this.running = false;
    }
  }

  copyOutput(result: QuickExecuteResult): void {
    navigator.clipboard.writeText([result.stdout, result.stderr].filter(Boolean).join('\n'));
  }

  downloadOutput(result: QuickExecuteResult): void {
    const blob = new Blob([`$ ${result.command}\n\n${result.stdout}\n${result.stderr}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quick-execute-${result.executedAt.replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
