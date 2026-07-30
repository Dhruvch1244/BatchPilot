import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { AppStateService } from '../core/app-state.service';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  template: `
    <footer class="status-bar">
      <div class="status-bar-left">
        @if (state.selectedEnvironment(); as env) {
          <span class="health-dot" [class]="'health-' + (state.selectedStatus()?.state ?? 'disconnected').toLowerCase()"></span>
          <span>{{ env.name }}</span>
          <span class="status-bar-sep">|</span>
          <span>{{ state.selectedStatus()?.state ?? 'DISCONNECTED' }}</span>
          @if (state.selectedStatus()?.latencyMs != null) {
            <span class="status-bar-sep">|</span>
            <span>{{ state.selectedStatus()?.latencyMs }} ms</span>
          }
          @if (connectedSince(); as since) {
            <span class="status-bar-sep">|</span>
            <span>since {{ since }}</span>
          }
          @if (state.selectedStatus()?.state === 'ERROR' && state.selectedStatus()?.message) {
            <span class="status-bar-sep">|</span>
            <span class="status-bar-error">{{ state.selectedStatus()?.message }}</span>
          }
        } @else {
          <span>No environment selected</span>
        }
      </div>
      <div class="status-bar-right">{{ now() }}</div>
    </footer>
  `
})
export class StatusBarComponent implements OnInit, OnDestroy {
  private timer?: ReturnType<typeof setInterval>;
  readonly now = signal(new Date().toLocaleString());

  constructor(public state: AppStateService) {}

  ngOnInit(): void {
    this.timer = setInterval(() => this.now.set(new Date().toLocaleString()), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  connectedSince(): string | null {
    const ts = this.state.selectedStatus()?.connectedSince;
    return ts != null ? new Date(ts).toLocaleTimeString() : null;
  }
}
