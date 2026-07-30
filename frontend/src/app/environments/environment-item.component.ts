import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ConnectionStatus, Environment } from '../core/models';

const STATE_LABEL: Record<string, string> = {
  CONNECTED: 'Connected',
  CONNECTING: 'Connecting…',
  RECONNECTING: 'Reconnecting…',
  ERROR: 'Error',
  DISCONNECTED: 'Disconnected'
};

@Component({
  selector: 'app-environment-item',
  standalone: true,
  template: `
    <div class="env-item" [class.env-item-selected]="selected" (click)="select.emit()">
      <span class="health-dot" [class]="'health-' + state().toLowerCase()" [title]="stateLabel()"></span>
      <div class="env-item-info">
        <div class="env-item-name">
          {{ environment.name }}
          <span class="env-badge" [class]="'env-badge-' + environment.type.toLowerCase()">{{ environment.type }}</span>
        </div>
        <div class="env-item-detail">
          {{ environment.username }}&#64;{{ environment.serverIp || 'not set' }}:{{ environment.sshPort }}
        </div>
      </div>
      <div class="env-item-actions" (click)="$event.stopPropagation()">
        <button class="icon-btn" type="button" title="Edit" (click)="edit.emit()">✎</button>
        <button class="icon-btn" type="button" title="Duplicate" (click)="duplicate.emit()">⎘</button>
        <button class="icon-btn" type="button" title="Delete" (click)="delete.emit()">✕</button>
      </div>
    </div>
  `
})
export class EnvironmentItemComponent {
  @Input({ required: true }) environment!: Environment;
  @Input() status?: ConnectionStatus;
  @Input() selected = false;
  @Output() select = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() duplicate = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  state(): string {
    return this.status?.state ?? 'DISCONNECTED';
  }

  stateLabel(): string {
    return STATE_LABEL[this.state()] ?? this.state();
  }
}
