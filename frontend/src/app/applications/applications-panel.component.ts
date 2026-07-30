import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { YarnApplication } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { LogsModalComponent } from '../shared/logs-modal.component';

const KILLABLE_STATES = new Set(['NEW', 'NEW_SAVING', 'SUBMITTED', 'ACCEPTED', 'RUNNING']);
const AUTO_REFRESH_MS = 8000;

// Matches the YARN application lifecycle order the user asked to sort by.
const STATE_ORDER: Record<string, number> = {
  NEW: 0,
  NEW_SAVING: 1,
  SUBMITTED: 2,
  ACCEPTED: 3,
  RUNNING: 4,
  FINISHED: 5,
  FAILED: 6,
  KILLED: 7
};

type SortMode = 'state' | 'name' | 'user';

@Component({
  selector: 'app-applications-panel',
  standalone: true,
  imports: [FormsModule, IconComponent, LogsModalComponent],
  template: `
    <div class="applications-panel">
      <div class="applications-toolbar">
        <span class="input-with-icon">
          <app-icon name="search" size="13" />
          <input class="file-manager-search" placeholder="Filter by name, user, or ID…" [(ngModel)]="filter" />
        </span>
        <label class="form-field-inline">
          <span>Sort</span>
          <select [(ngModel)]="sortMode">
            <option value="state">State</option>
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
        @if (!loading && sorted().length === 0) {
          <div class="stage-empty">No YARN applications found.</div>
        }
        @for (app of sorted(); track app.applicationId) {
          <div class="app-card app-card-clickable" (click)="openLogs(app)">
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
            <button
              class="icon-btn icon-btn-danger"
              type="button"
              title="Kill application"
              [disabled]="!isKillable(app) || killing.has(app.applicationId)"
              (click)="kill(app, $event)"
            >
              <app-icon name="stop" size="15" />
            </button>
          </div>
        }
      </div>
    </div>

    @if (logsFor) {
      <app-logs-modal [environmentId]="environmentId" [applicationId]="logsFor" (close)="logsFor = null" />
    }
  `
})
export class ApplicationsPanelComponent implements OnInit, OnDestroy {
  @Input({ required: true }) environmentId!: string;

  applications: YarnApplication[] = [];
  loading = false;
  error: string | null = null;
  filter = '';
  sortMode: SortMode = 'state';
  killing = new Set<string>();
  logsFor: string | null = null;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => this.load(), AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  filtered(): YarnApplication[] {
    const needle = this.filter.trim().toLowerCase();
    if (!needle) return this.applications;
    return this.applications.filter(
      (a) =>
        a.applicationName.toLowerCase().includes(needle) ||
        a.applicationId.toLowerCase().includes(needle) ||
        a.user.toLowerCase().includes(needle)
    );
  }

  sorted(): YarnApplication[] {
    const list = [...this.filtered()];
    if (this.sortMode === 'name') {
      list.sort((a, b) => a.applicationName.localeCompare(b.applicationName));
    } else if (this.sortMode === 'user') {
      list.sort((a, b) => a.user.localeCompare(b.user));
    } else {
      list.sort((a, b) => (STATE_ORDER[a.state] ?? 99) - (STATE_ORDER[b.state] ?? 99));
    }
    return list;
  }

  isKillable(app: YarnApplication): boolean {
    return KILLABLE_STATES.has(app.state);
  }

  openLogs(app: YarnApplication): void {
    this.logsFor = app.applicationId;
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.applications = await firstValueFrom(this.api.listYarnApplications(this.environmentId));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to list YARN applications';
    } finally {
      this.loading = false;
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
