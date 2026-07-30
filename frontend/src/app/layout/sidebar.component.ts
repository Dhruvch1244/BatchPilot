import { Component, EventEmitter, Output } from '@angular/core';
import { AppStateService } from '../core/app-state.service';
import { Environment } from '../core/models';
import { EnvironmentItemComponent } from '../environments/environment-item.component';
import { IconComponent } from '../shared/icon.component';

const COLLAPSED_STORAGE_KEY = 'batchpilot.sidebarCollapsed';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [EnvironmentItemComponent, IconComponent],
  template: `
    <aside class="sidebar" [class.sidebar-collapsed]="collapsed">
      @if (collapsed) {
        <button class="sidebar-expand-btn" type="button" title="Show environments" (click)="toggleCollapsed()">
          <app-icon name="chevron-right" size="15" />
        </button>
      } @else {
        <div class="sidebar-header">
          <span>Environments</span>
          <div class="sidebar-header-actions">
            <button class="icon-btn" type="button" title="New Environment" (click)="createEnvironment.emit()"><app-icon name="plus" size="15" /></button>
            <button class="icon-btn" type="button" title="Collapse sidebar" (click)="toggleCollapsed()"><app-icon name="chevron-left" size="15" /></button>
          </div>
        </div>
        <div class="sidebar-list">
          @if (state.environments().length === 0) {
            <div class="sidebar-empty">No environments yet.</div>
          }
          @for (env of state.environments(); track env.id) {
            <app-environment-item
              [environment]="env"
              [status]="state.statuses()[env.id]"
              [selected]="env.id === state.selectedEnvironmentId()"
              (select)="state.selectEnvironment(env.id)"
              (edit)="editEnvironment.emit(env)"
              (duplicate)="state.duplicateEnvironment(env.id)"
              (delete)="onDelete(env)"
            />
          }
        </div>
      }
    </aside>
  `
})
export class SidebarComponent {
  @Output() createEnvironment = new EventEmitter<void>();
  @Output() editEnvironment = new EventEmitter<Environment>();

  collapsed = localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';

  constructor(public state: AppStateService) {}

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(this.collapsed));
  }

  onDelete(env: Environment): void {
    if (window.confirm(`Delete environment "${env.name}"?`)) {
      this.state.deleteEnvironment(env.id);
    }
  }
}
