import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AppStateService } from '../core/app-state.service';
import { CommandHistoryEntry, QuickExecuteResult } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';

@Component({
  selector: 'app-quick-execute-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, IconComponent, ModalComponent],
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

        @if (pastCommands.length > 0) {
          <div class="quick-execute-past">
            <button class="quick-execute-past-toggle" type="button" (click)="showPast = !showPast">
              <app-icon [name]="showPast ? 'chevron-up' : 'chevron-down'" size="12" />
              Past commands ({{ pastCommands.length }})
            </button>
            @if (showPast) {
              <div class="quick-execute-past-list">
                @for (entry of pastCommands; track entry.id) {
                  <button class="quick-execute-past-item" type="button" title="Use this command again" (click)="usePast(entry)">
                    <span class="status-badge" [class]="entry.success ? 'status-success' : 'status-failure'">
                      {{ entry.success ? 'OK' : 'EXIT ' + entry.exitCode }}
                    </span>
                    <span class="quick-execute-past-command">{{ entry.command }}</span>
                    <span class="quick-execute-past-meta">{{ entry.environmentName }} · {{ entry.executedAt | date: 'short' }}</span>
                  </button>
                }
              </div>
            }
          </div>
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
  /** Persisted across sessions (unlike `history` above, which is just this modal
   * instance's own run output) so past command text survives reopening the modal. */
  pastCommands: CommandHistoryEntry[] = [];
  showPast = false;

  constructor(private api: ApiService, public state: AppStateService) {}

  ngOnInit(): void {
    this.targetId = this.environmentId ?? this.connectedEnvironments()[0]?.id ?? '';
    this.loadPastCommands();
  }

  async loadPastCommands(): Promise<void> {
    try {
      this.pastCommands = await firstValueFrom(this.api.commandHistory('QUICK_EXECUTE', 20));
    } catch {
      // Non-fatal: past-command recall is a convenience, not required to run a command.
    }
  }

  usePast(entry: CommandHistoryEntry): void {
    this.command = entry.command;
    if (this.connectedEnvironments().some((e) => e.id === entry.environmentId)) {
      this.targetId = entry.environmentId;
    }
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
      await this.loadPastCommands();
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
