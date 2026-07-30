import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { extractCoreFileName } from '../core/extract-file-name';
import { YarnApplication } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { LogsModalComponent } from '../shared/logs-modal.component';

const KILLABLE_STATES = new Set(['NEW', 'NEW_SAVING', 'SUBMITTED', 'ACCEPTED', 'RUNNING']);
const RUNNING_STATES = KILLABLE_STATES;
const AUTO_REFRESH_MS = 8000;
const PAGE_SIZE = 20;

type Category = 'running' | 'finished' | 'failed' | 'killed';
type SortMode = 'time' | 'name' | 'user';

const CATEGORY_META: Record<Category, { label: string; collapsible: boolean }> = {
  running: { label: 'Running', collapsible: false },
  finished: { label: 'Finished', collapsible: true },
  failed: { label: 'Failed', collapsible: true },
  killed: { label: 'Killed', collapsible: true }
};

function categoryOf(state: string): Category {
  if (RUNNING_STATES.has(state)) return 'running';
  if (state === 'FAILED') return 'failed';
  if (state === 'KILLED') return 'killed';
  return 'finished';
}

/** application_<clusterTimestamp>_<sequence> -- the sequence number increments
 * monotonically per submission within one ResourceManager session, so it's a fast,
 * accurate-enough proxy for submission order without an extra `-status` round trip
 * per application (which `-list` doesn't return timestamps from at all). */
function appIdSequence(id: string): number {
  const match = id.match(/^application_\d+_(\d+)$/);
  return match ? Number(match[1]) : 0;
}

@Component({
  selector: 'app-applications-panel',
  standalone: true,
  imports: [FormsModule, IconComponent, LogsModalComponent],
  template: `
    <div class="applications-panel">
      <div class="applications-toolbar">
        <span class="input-with-icon">
          <app-icon name="search" size="13" />
          <input
            class="file-manager-search"
            placeholder="Filter by name, user, or ID…"
            [(ngModel)]="filter"
            (ngModelChange)="onFilterOrSortChange()"
          />
        </span>
        <label class="form-field-inline">
          <span>Sort</span>
          <select [(ngModel)]="sortMode" (ngModelChange)="onFilterOrSortChange()">
            <option value="time">Newest first</option>
            <option value="name">Name</option>
            <option value="user">User</option>
          </select>
        </label>
        <button class="btn" type="button" [disabled]="loading" (click)="load()">
          <app-icon name="refresh" size="14" [spin]="loading" />
          Refresh
        </button>
      </div>

      @if (error) {
        <div class="form-error">{{ error }}</div>
      }
      @if (loading && applications.length === 0) {
        <div class="file-manager-loading">Loading applications…</div>
      }

      <div class="applications-list">
        @if (!loading && applications.length === 0) {
          <div class="stage-empty">No YARN applications found.</div>
        }
        @for (cat of categories; track cat) {
          @if (grouped[cat].length > 0 || cat === 'running') {
            <div class="app-section">
              <button
                class="app-section-header"
                type="button"
                [class.app-section-header-static]="!meta[cat].collapsible"
                (click)="meta[cat].collapsible && toggleSection(cat)"
              >
                @if (meta[cat].collapsible) {
                  <app-icon [name]="collapsed[cat] ? 'chevron-down' : 'chevron-up'" size="13" />
                }
                <span>{{ meta[cat].label }}</span>
                <span class="app-section-count">{{ grouped[cat].length }}</span>
              </button>

              @if (!collapsed[cat]) {
                @for (app of pageOf(cat); track app.applicationId) {
                  <div class="app-card app-card-clickable" (click)="goToStageTracker(app)">
                    <div class="app-card-info">
                      <div class="app-card-name">{{ app.applicationName || app.applicationId }}</div>
                      <div class="app-card-meta">
                        <code>{{ app.applicationId }}</code>
                        <span>{{ app.user }}</span>
                        <span>queue: {{ app.queue }}</span>
                        <span>{{ app.applicationType }}</span>
                      </div>
                    </div>
                    @if (app.progressPercent != null) {
                      <div class="app-progress-track" title="{{ app.progressPercent }}%">
                        <div class="app-progress-bar" [style.width.%]="app.progressPercent"></div>
                      </div>
                    }
                    <span class="app-state-badge" [class]="'app-state-' + app.state.toLowerCase()">{{ app.state }}</span>
                    <button class="icon-btn" type="button" title="View logs" (click)="openLogs(app, $event)">
                      <app-icon name="file-search" size="15" />
                    </button>
                    @if (isKillable(app)) {
                      <button
                        class="icon-btn icon-btn-danger"
                        type="button"
                        title="Kill application"
                        [disabled]="killing.has(app.applicationId)"
                        (click)="kill(app, $event)"
                      >
                        <app-icon name="stop" size="15" />
                      </button>
                    }
                  </div>
                }

                @if (pageCount(cat) > 1) {
                  <div class="app-pagination">
                    <button class="btn" type="button" [disabled]="page[cat] === 0" (click)="setPage(cat, page[cat] - 1)">
                      Prev
                    </button>
                    <span>Page {{ page[cat] + 1 }} of {{ pageCount(cat) }}</span>
                    <button
                      class="btn"
                      type="button"
                      [disabled]="page[cat] >= pageCount(cat) - 1"
                      (click)="setPage(cat, page[cat] + 1)"
                    >
                      Next
                    </button>
                  </div>
                }
              }
            </div>
          }
        }
      </div>
    </div>

    @if (logsFor) {
      <app-logs-modal [environmentId]="environmentId" [applicationId]="logsFor" (close)="logsFor = null" />
    }
  `,
  styles: [`
    .app-section { display: flex; flex-direction: column; gap: 8px; }
    .app-section-header {
      display: flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: none;
      padding: 4px 2px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-dim);
      cursor: pointer;
    }
    .app-section-header-static { cursor: default; }
    .app-section-count {
      background: var(--bg-panel-alt);
      border-radius: 999px;
      padding: 1px 7px;
      font-size: 10px;
    }
    .app-pagination {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: center;
      padding: 6px 0 4px;
      font-size: 11px;
      color: var(--text-dim);
    }
  `]
})
export class ApplicationsPanelComponent implements OnInit, OnDestroy {
  @Input({ required: true }) environmentId!: string;
  @Output() openStageTrackerFor = new EventEmitter<string>();

  applications: YarnApplication[] = [];
  loading = false;
  error: string | null = null;
  filter = '';
  sortMode: SortMode = 'time';
  killing = new Set<string>();
  logsFor: string | null = null;

  readonly categories: Category[] = ['running', 'finished', 'failed', 'killed'];
  readonly meta = CATEGORY_META;
  collapsed: Record<Category, boolean> = { running: false, finished: true, failed: false, killed: true };
  page: Record<Category, number> = { running: 0, finished: 0, failed: 0, killed: 0 };
  grouped: Record<Category, YarnApplication[]> = { running: [], finished: [], failed: [], killed: [] };

  private timer?: ReturnType<typeof setInterval>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => this.load(), AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  toggleSection(cat: Category): void {
    this.collapsed[cat] = !this.collapsed[cat];
  }

  onFilterOrSortChange(): void {
    for (const cat of this.categories) {
      this.page[cat] = 0;
    }
    this.regroup();
  }

  isKillable(app: YarnApplication): boolean {
    return KILLABLE_STATES.has(app.state);
  }

  pageOf(cat: Category): YarnApplication[] {
    const start = this.page[cat] * PAGE_SIZE;
    return this.grouped[cat].slice(start, start + PAGE_SIZE);
  }

  pageCount(cat: Category): number {
    return Math.max(1, Math.ceil(this.grouped[cat].length / PAGE_SIZE));
  }

  setPage(cat: Category, page: number): void {
    this.page[cat] = Math.max(0, Math.min(page, this.pageCount(cat) - 1));
  }

  openLogs(app: YarnApplication, event: Event): void {
    event.stopPropagation();
    this.logsFor = app.applicationId;
  }

  goToStageTracker(app: YarnApplication): void {
    this.openStageTrackerFor.emit(extractCoreFileName(app.applicationName || app.applicationId));
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.applications = await firstValueFrom(this.api.listYarnApplications(this.environmentId));
      this.regroup();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to list YARN applications';
    } finally {
      this.loading = false;
    }
  }

  private regroup(): void {
    const needle = this.filter.trim().toLowerCase();
    const filtered = needle
      ? this.applications.filter(
          (a) =>
            a.applicationName.toLowerCase().includes(needle) ||
            a.applicationId.toLowerCase().includes(needle) ||
            a.user.toLowerCase().includes(needle)
        )
      : this.applications;

    const sorted = [...filtered];
    if (this.sortMode === 'name') {
      sorted.sort((a, b) => a.applicationName.localeCompare(b.applicationName));
    } else if (this.sortMode === 'user') {
      sorted.sort((a, b) => a.user.localeCompare(b.user));
    } else {
      sorted.sort((a, b) => appIdSequence(b.applicationId) - appIdSequence(a.applicationId));
    }

    const next: Record<Category, YarnApplication[]> = { running: [], finished: [], failed: [], killed: [] };
    for (const app of sorted) {
      next[categoryOf(app.state)].push(app);
    }
    this.grouped = next;
    for (const cat of this.categories) {
      this.page[cat] = Math.min(this.page[cat], this.pageCount(cat) - 1);
    }
  }

  async kill(app: YarnApplication, event: Event): Promise<void> {
    event.stopPropagation();
    if (!window.confirm(`Kill application "${app.applicationName || app.applicationId}"?`)) return;
    this.killing.add(app.applicationId);
    try {
      await firstValueFrom(this.api.killYarnApplication(this.environmentId, app.applicationId));
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to kill application';
    } finally {
      this.killing.delete(app.applicationId);
    }
  }
}
