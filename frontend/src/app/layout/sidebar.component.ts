import { Component, EventEmitter, Output } from '@angular/core';
import { AppStateService } from '../core/app-state.service';
import { Environment } from '../core/models';
import { EnvironmentItemComponent } from '../environments/environment-item.component';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [EnvironmentItemComponent, IconComponent],
  template: `
    <aside class="sidebar">
      <div class="sidebar-header">
        <span>Environments</span>
        <button class="icon-btn" type="button" title="New Environment" (click)="createEnvironment.emit()"><app-icon name="plus" size="15" /></button>
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
    </aside>
  `
})
export class SidebarComponent {
  @Output() createEnvironment = new EventEmitter<void>();
  @Output() editEnvironment = new EventEmitter<Environment>();

  constructor(public state: AppStateService) {}

  onDelete(env: Environment): void {
    if (window.confirm(`Delete environment "${env.name}"?`)) {
      this.state.deleteEnvironment(env.id);
    }
  }
}
