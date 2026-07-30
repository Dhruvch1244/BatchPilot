import { Component, EventEmitter, Output } from '@angular/core';
import { AppStateService } from '../core/app-state.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [IconComponent],
  template: `
    <header class="toolbar">
      <div class="toolbar-brand">
        <span class="toolbar-brand-mark">BP</span>
        <span>BatchPilot</span>
      </div>
      <div class="toolbar-actions">
        <button
          class="btn"
          [disabled]="!state.selectedEnvironment() || connected() || busy()"
          (click)="connectSelected()"
        >
          <app-icon name="plug" size="14" />
          Connect
        </button>
        <button class="btn" [disabled]="!state.selectedEnvironment() || !connected()" (click)="disconnectSelected()">
          <app-icon name="plug-off" size="14" />
          Disconnect
        </button>
        <button class="btn" [disabled]="!state.selectedEnvironment() || busy()" (click)="reconnectSelected()">
          <app-icon name="refresh" size="14" />
          Reconnect
        </button>
        <div class="toolbar-sep"></div>
        <button class="btn" [disabled]="!state.selectedEnvironment()" (click)="newTerminal.emit()">
          <app-icon name="terminal" size="14" />
          Terminal
        </button>
        <button class="btn" [disabled]="!state.selectedEnvironment() || !connected()" (click)="openFiles.emit()">
          <app-icon name="folder" size="14" />
          Files
        </button>
        <button
          class="btn"
          [disabled]="!state.selectedEnvironment() || !connected()"
          (click)="openQuickExecute.emit()"
        >
          <app-icon name="play" size="14" />
          Quick Execute
        </button>
        <button
          class="btn"
          [disabled]="!state.selectedEnvironment() || !connected()"
          (click)="openApplications.emit()"
        >
          <app-icon name="activity" size="14" />
          Applications
        </button>
        <button
          class="btn"
          [disabled]="!state.selectedEnvironment() || !connected()"
          (click)="openStageTracker.emit()"
        >
          <app-icon name="file-search" size="14" />
          Stage Tracker
        </button>
        <button
          class="btn"
          [disabled]="!state.selectedEnvironment() || !connected()"
          (click)="openS3Transfer.emit()"
        >
          <app-icon name="download" size="14" />
          S3 Transfer
        </button>
        <div class="toolbar-sep"></div>
        <button class="btn icon-btn" title="Settings" (click)="openSettings.emit()">
          <app-icon name="settings" size="16" />
        </button>
      </div>
    </header>
  `
})
export class ToolbarComponent {
  @Output() newTerminal = new EventEmitter<void>();
  @Output() openFiles = new EventEmitter<void>();
  @Output() openQuickExecute = new EventEmitter<void>();
  @Output() openSettings = new EventEmitter<void>();
  @Output() openApplications = new EventEmitter<void>();
  @Output() openStageTracker = new EventEmitter<void>();
  @Output() openS3Transfer = new EventEmitter<void>();

  constructor(public state: AppStateService) {}

  connected(): boolean {
    return this.state.selectedStatus()?.state === 'CONNECTED';
  }

  busy(): boolean {
    const s = this.state.selectedStatus()?.state;
    return s === 'CONNECTING' || s === 'RECONNECTING';
  }

  connectSelected(): void {
    const env = this.state.selectedEnvironment();
    if (env) this.state.connect(env.id);
  }

  disconnectSelected(): void {
    const env = this.state.selectedEnvironment();
    if (env) this.state.disconnect(env.id);
  }

  reconnectSelected(): void {
    const env = this.state.selectedEnvironment();
    if (env) this.state.reconnect(env.id);
  }
}
