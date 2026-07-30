import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PipelineStage, StageGroup, StageMatch, StageSearchHistoryEntry, StageSearchResult } from '../core/models';
import { IconComponent, IconName } from '../shared/icon.component';

const KILLABLE_STATES = new Set(['NEW', 'NEW_SAVING', 'SUBMITTED', 'ACCEPTED', 'RUNNING']);
const RUNNING_STATES = new Set(['NEW', 'NEW_SAVING', 'SUBMITTED', 'ACCEPTED', 'RUNNING']);
const FAILED_STATES = new Set(['FAILED', 'KILLED']);

const STAGE_ICONS: Record<PipelineStage, IconName> = {
  PREPROCESSOR: 'activity',
  VALIDATION: 'check-circle',
  NORMALIZATION: 'refresh',
  DAAF: 'server',
  TRANSMISSION: 'download'
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
  imports: [FormsModule, DatePipe, NgTemplateOutlet, IconComponent],
  template: `
    <div class="stage-tracker-panel">
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
        <button class="btn btn-primary" type="button" [disabled]="searching || !query.trim()" (click)="search()">
          <app-icon name="file-search" size="14" />
          Search
        </button>
      </div>

      @if (history.length > 0) {
        <div class="stage-history">
          @for (h of history; track h.id) {
            <button class="stage-history-chip" type="button" [title]="h.environmentName" (click)="rerun(h)">
              <app-icon name="history" size="11" />
              {{ h.filename }}
              <span>({{ h.matchCount }})</span>
            </button>
          }
        </div>
      }

      @if (error) {
        <div class="form-error">{{ error }}</div>
      }
      @if (searching) {
        <div class="file-manager-loading">Searching…</div>
      }

      @if (result) {
        <div class="run-card">
          <div class="run-card-header">
            <span class="run-card-title">{{ result.filename }}</span>
            <span class="quick-execute-duration">searched {{ result.searchedAt | date: 'medium' }}</span>
          </div>

          <div class="stage-pipeline">
            @for (group of result.stages; track group.stage) {
              <div class="stage-step" [class]="stepClass(group)">
                <div class="stage-step-icon"><app-icon [name]="stageIcon(group.stage)" size="16" /></div>
                <div class="stage-step-name">{{ group.label }}</div>
                <div class="stage-step-duration">
                  {{ group.matches.length > 0 ? group.matches.length + ' run' + (group.matches.length > 1 ? 's' : '') : '—' }}
                </div>
              </div>
            }
          </div>

          @for (group of result.stages; track group.stage) {
            @if (group.matches.length > 0) {
              <div class="stage-detail-group">
                <span class="stage-group-label">{{ group.label }}</span>
                @for (m of group.matches; track m.applicationId) {
                  <ng-container *ngTemplateOutlet="matchRow; context: { $implicit: m }"></ng-container>
                }
              </div>
            }
          }

          @if (result.unclassifiedMatches.length > 0) {
            <div class="stage-detail-group">
              <span class="stage-group-label">Other matches (stage not recognized from name)</span>
              @for (m of result.unclassifiedMatches; track m.applicationId) {
                <ng-container *ngTemplateOutlet="matchRow; context: { $implicit: m }"></ng-container>
              }
            </div>
          }

          @if (isEmpty(result)) {
            <div class="stage-empty">No running or recent YARN applications match "{{ result.filename }}".</div>
          }
        </div>
      }

      <ng-template #matchRow let-m>
        <div class="app-card">
          <div class="app-card-info">
            <div class="app-card-name">{{ m.applicationName }}</div>
            <div class="app-card-meta">
              <code>{{ m.applicationId }}</code>
              <span><app-icon name="clock" size="11" /> {{ duration(m.elapsedMs) }}</span>
              @if (m.startTime) {
                <span>started {{ m.startTime | date: 'short' }}</span>
              }
            </div>
          </div>
          @if (m.progressPercent != null) {
            <div class="app-progress-track" [title]="m.progressPercent + '%'">
              <div class="app-progress-bar" [style.width.%]="m.progressPercent"></div>
            </div>
          }
          <span class="app-state-badge" [class]="'app-state-' + m.state.toLowerCase()">{{ m.state }}</span>
          <button
            class="icon-btn icon-btn-danger"
            type="button"
            title="Kill application"
            [disabled]="!killable(m) || killing.has(m.applicationId)"
            (click)="kill(m)"
          >
            <app-icon name="stop" size="15" />
          </button>
        </div>
      </ng-template>
    </div>
  `
})
export class StageTrackerPanelComponent implements OnInit {
  @Input({ required: true }) environmentId!: string;

  query = '';
  result: StageSearchResult | null = null;
  history: StageSearchHistoryEntry[] = [];
  searching = false;
  error: string | null = null;
  killing = new Set<string>();

  readonly duration = formatDuration;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadHistory();
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

  isEmpty(result: StageSearchResult): boolean {
    return result.stages.every((g) => g.matches.length === 0) && result.unclassifiedMatches.length === 0;
  }

  async kill(match: StageMatch): Promise<void> {
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
