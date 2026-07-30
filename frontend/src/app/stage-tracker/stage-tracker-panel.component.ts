import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { FileStageResult, PipelineStage, StageGroup, StageMatch, StageSearchHistoryEntry, StageSearchResult } from '../core/models';
import { IconComponent, IconName } from '../shared/icon.component';
import { LogsModalComponent } from '../shared/logs-modal.component';

const KILLABLE_STATES = new Set(['NEW', 'NEW_SAVING', 'SUBMITTED', 'ACCEPTED', 'RUNNING']);
const RUNNING_STATES = KILLABLE_STATES;
const FAILED_STATES = new Set(['FAILED', 'KILLED']);

const STAGE_ICONS: Record<PipelineStage, IconName> = {
  PREPROCESSOR: 'activity',
  VALIDATION: 'check-circle',
  NORMALIZATION: 'refresh',
  DELTA: 'server',
  TRANSMISSION: 'download',
  OUTBOUND: 'download'
};

function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

@Component({
  selector: 'app-stage-tracker-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, NgTemplateOutlet, IconComponent, LogsModalComponent],
  template: `
    <div class="stage-tracker-panel">
      <div class="stage-tracker-main">
        <div class="stage-tracker-main-inner">
          <div class="stage-search-bar">
            <span class="input-with-icon">
              <app-icon name="search" size="14" />
              <input
                class="file-manager-search"
                placeholder="Search by filename to find its pipeline applications…"
                [(ngModel)]="query"
                (keydown.enter)="search()"
              />
            </span>
            <button class="btn" type="button" [disabled]="searching || !query.trim()" title="Refresh" (click)="search()">
              <app-icon name="refresh" size="14" [spin]="searching" />
            </button>
            <button class="btn btn-primary" type="button" [disabled]="searching || !query.trim()" (click)="search()">
              <app-icon name="file-search" size="14" />
              Search
            </button>
          </div>

          @if (error) {
            <div class="form-error">{{ error }}</div>
          }
          @if (searching) {
            <div class="file-manager-loading">Searching…</div>
          }

          @if (result && !searching) {
            @if (result.files.length === 0) {
              <div class="stage-empty">No running or recent YARN applications match "{{ result.query }}".</div>
            }
            @for (file of result.files; track file.coreFileName) {
              <div class="run-card">
                <div class="run-card-header">
                  <span class="run-card-title">{{ file.coreFileName }}</span>
                  <div class="run-card-meta">
                    @if (file.latestCompletedAt) {
                      <span><app-icon name="check-circle" size="11" /> last completed {{ file.latestCompletedAt | date: 'medium' }}</span>
                    }
                    <span class="quick-execute-duration">searched {{ result.searchedAt | date: 'short' }}</span>
                  </div>
                </div>

                @if (file.stages.length > 0) {
                  <div class="stage-pipeline">
                    @for (group of file.stages; track group.stage) {
                      <div class="stage-step" [class]="stepClass(group)">
                        <div class="stage-step-icon"><app-icon [name]="stageIcon(group.stage)" size="16" /></div>
                        <div class="stage-step-name">{{ group.label }}</div>
                        <div class="stage-step-duration">
                          {{ group.matches.length }} run{{ group.matches.length > 1 ? 's' : '' }}
                        </div>
                      </div>
                    }
                  </div>
                }

                @for (group of file.stages; track group.stage) {
                  <div class="stage-detail-group">
                    <span class="stage-group-label">{{ group.label }}</span>
                    @for (m of group.matches; track m.applicationId) {
                      <ng-container *ngTemplateOutlet="matchRow; context: { $implicit: m, file: file }"></ng-container>
                    }
                  </div>
                }

                @if (file.unclassifiedMatches.length > 0) {
                  <div class="stage-detail-group">
                    <span class="stage-group-label">Other matches (stage not recognized from name)</span>
                    @for (m of file.unclassifiedMatches; track m.applicationId) {
                      <ng-container *ngTemplateOutlet="matchRow; context: { $implicit: m, file: file }"></ng-container>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>

      <aside class="stage-tracker-sidebar">
        <div class="stage-tracker-sidebar-header">Recent searches</div>
        @if (history.length === 0) {
          <div class="stage-empty" style="padding: 12px 4px;">No searches yet.</div>
        }
        @for (h of history; track h.id) {
          <button
            class="stage-history-item"
            type="button"
            [class.stage-history-item-active]="h.filename === query"
            [title]="h.environmentName"
            (click)="rerun(h)"
          >
            <app-icon name="file-search" size="13" />
            <span class="stage-history-name">{{ h.filename }}</span>
            <span class="stage-history-count">{{ h.matchCount }}</span>
          </button>
        }
      </aside>

      <ng-template #matchRow let-m let-file="file">
        <div class="app-card app-card-clickable" title="Click to focus on just this file" (click)="focusFile(file)">
          <div class="app-card-info">
            <div class="app-card-name">{{ m.applicationName }}</div>
            <div class="app-card-meta">
              <code>{{ m.applicationId }}</code>
              <span><app-icon name="clock" size="11" /> {{ duration(m.elapsedMs) }}</span>
              @if (m.startTime) {
                <span>started {{ m.startTime | date: 'short' }}</span>
              }
              @if (m.finishTime) {
                <span>finished {{ m.finishTime | date: 'short' }}</span>
              }
            </div>
          </div>
          @if (m.progressPercent != null) {
            <div class="app-progress-track" [title]="m.progressPercent + '%'">
              <div class="app-progress-bar" [style.width.%]="m.progressPercent"></div>
            </div>
          }
          <span class="app-state-badge" [class]="'app-state-' + m.state.toLowerCase()">{{ m.state }}</span>
          <button class="icon-btn" type="button" title="View logs" (click)="openLogs(m, $event)">
            <app-icon name="file-search" size="15" />
          </button>
          @if (killable(m)) {
            <button
              class="icon-btn icon-btn-danger"
              type="button"
              title="Kill application"
              [disabled]="killing.has(m.applicationId)"
              (click)="kill(m, $event)"
            >
              <app-icon name="stop" size="15" />
            </button>
          }
        </div>
      </ng-template>
    </div>

    @if (logsFor) {
      <app-logs-modal [environmentId]="environmentId" [applicationId]="logsFor" (close)="logsFor = null" />
    }
  `
})
export class StageTrackerPanelComponent implements OnInit {
  @Input({ required: true }) environmentId!: string;
  @Input() initialQuery?: string;

  query = '';
  result: StageSearchResult | null = null;
  history: StageSearchHistoryEntry[] = [];
  searching = false;
  error: string | null = null;
  killing = new Set<string>();
  logsFor: string | null = null;

  readonly duration = formatDuration;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadHistory();
    if (this.initialQuery && this.initialQuery.trim()) {
      this.query = this.initialQuery.trim();
      this.search();
    }
  }

  async loadHistory(): Promise<void> {
    try {
      this.history = await firstValueFrom(this.api.stageSearchHistory());
    } catch {
      // Non-fatal: history is a convenience, not required for a fresh search.
    }
  }

  rerun(entry: StageSearchHistoryEntry): void {
    this.query = entry.filename;
    this.search();
  }

  focusFile(file: FileStageResult): void {
    this.query = file.coreFileName;
    this.search();
  }

  async search(): Promise<void> {
    if (!this.query.trim()) return;
    this.searching = true;
    this.error = null;
    try {
      this.result = await firstValueFrom(this.api.searchStages(this.environmentId, this.query.trim()));
      await this.loadHistory();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Search failed';
    } finally {
      this.searching = false;
    }
  }

  stageIcon(stage: PipelineStage): IconName {
    return STAGE_ICONS[stage];
  }

  stepClass(group: StageGroup): string {
    if (group.matches.length === 0) return 'stage-step-pending';
    if (group.matches.some((m) => RUNNING_STATES.has(m.state))) return 'stage-step-active';
    if (group.matches.some((m) => FAILED_STATES.has(m.state) || FAILED_STATES.has(m.finalStatus))) return 'stage-step-failed';
    return 'stage-step-done';
  }

  killable(match: StageMatch): boolean {
    return KILLABLE_STATES.has(match.state);
  }

  openLogs(match: StageMatch, event: Event): void {
    event.stopPropagation();
    this.logsFor = match.applicationId;
  }

  async kill(match: StageMatch, event: Event): Promise<void> {
    event.stopPropagation();
    if (!window.confirm(`Kill application "${match.applicationName || match.applicationId}"?`)) return;
    this.killing.add(match.applicationId);
    try {
      await firstValueFrom(this.api.killYarnApplication(this.environmentId, match.applicationId));
      await this.search();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to kill application';
    } finally {
      this.killing.delete(match.applicationId);
    }
  }
}
