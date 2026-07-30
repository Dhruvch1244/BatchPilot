import { Component, EventEmitter, Output } from '@angular/core';
import { AppStateService } from '../core/app-state.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  template: `
    <header class="toolbar">
      <div class="toolbar-brand">BatchPilot</div>
      <div class="toolbar-actions">
        <button
          class="btn"
          [disabled]="!state.selectedEnvironment() || connected() || busy()"
          (click)="connectSelected()"
        >
          Connect
        </button>
        <button class="btn" [disabled]="!state.selectedEnvironment() || !connected()" (click)="disconnectSelected()">
          Disconnect
        </button>
        <button class="btn" [disabled]="!state.selectedEnvironment() || busy()" (click)="reconnectSelected()">
          Reconnect
        </button>
        <div class="toolbar-sep"></div>
        <button class="btn" [disabled]="!state.selectedEnvironment()" (click)="newTerminal.emit()">+ Terminal</button>
        <button class="btn" [disabled]="!state.selectedEnvironment() || !connected()" (click)="openFiles.emit()">
          Files
        </button>
        <button
          class="btn"
          [disabled]="!state.selectedEnvironment() || !connected()"
          (click)="openQuickExecute.emit()"
        >
          Quick Execute
        </button>
        <div class="toolbar-sep"></div>
        <button class="btn" (click)="openSettings.emit()">Settings</button>
      </div>
    </header>
  `
})
export class ToolbarComponent {
  @Output() newTerminal = new EventEmitter<void>();
  @Output() openFiles = new EventEmitter<void>();
  @Output() openQuickExecute = new EventEmitter<void>();
  @Output() openSettings = new EventEmitter<void>();

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
