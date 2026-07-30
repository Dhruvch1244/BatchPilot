import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { YarnApplication } from '../core/models';
import { IconComponent } from '../shared/icon.component';

const KILLABLE_STATES = new Set(['NEW', 'NEW_SAVING', 'SUBMITTED', 'ACCEPTED', 'RUNNING']);
const AUTO_REFRESH_MS = 8000;

@Component({
  selector: 'app-applications-panel',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="applications-panel">
      <div class="applications-toolbar">
        <span class="input-with-icon">
          <app-icon name="search" size="13" />
          <input class="file-manager-search" placeholder="Filter by name, user, or ID…" [(ngModel)]="filter" />
        </span>
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
        @if (!loading && filtered().length === 0) {
          <div class="stage-empty">No YARN applications found.</div>
        }
        @for (app of filtered(); track app.applicationId) {
          <div class="app-card">
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
              (click)="kill(app)"
            >
              <app-icon name="stop" size="15" />
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class ApplicationsPanelComponent implements OnInit, OnDestroy {
  @Input({ required: true }) environmentId!: string;

  applications: YarnApplication[] = [];
  loading = false;
  error: string | null = null;
  filter = '';
  killing = new Set<string>();
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

  isKillable(app: YarnApplication): boolean {
    return KILLABLE_STATES.has(app.state);
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

  async kill(app: YarnApplication): Promise<void> {
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
