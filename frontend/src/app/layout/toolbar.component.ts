import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AppStateService } from '../core/app-state.service';
import { Tab, TabType } from '../core/models';
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

        <div class="toolbar-btn-group" (mouseenter)="onGroupHover('terminal', $event)" (mouseleave)="scheduleLeave()">
          <button class="btn" [disabled]="!state.selectedEnvironment()" (click)="newTerminal.emit()">
            <app-icon name="terminal" size="14" />
            Terminal
          </button>
        </div>

        <div class="toolbar-btn-group" (mouseenter)="onGroupHover('files', $event)" (mouseleave)="scheduleLeave()">
          <button class="btn" [disabled]="!state.selectedEnvironment() || !connected()" (click)="openFiles.emit()">
            <app-icon name="folder" size="14" />
            Files
          </button>
        </div>

        <button
          class="btn"
          [disabled]="!state.selectedEnvironment() || !connected()"
          (click)="openQuickExecute.emit()"
        >
          <app-icon name="play" size="14" />
          Quick Execute
        </button>

        <div class="toolbar-btn-group" (mouseenter)="onGroupHover('applications', $event)" (mouseleave)="scheduleLeave()">
          <button
            class="btn"
            [disabled]="!state.selectedEnvironment() || !connected()"
            (click)="openApplications.emit()"
          >
            <app-icon name="activity" size="14" />
            Applications
          </button>
        </div>

        <div class="toolbar-btn-group" (mouseenter)="onGroupHover('stage-tracker', $event)" (mouseleave)="scheduleLeave()">
          <button
            class="btn"
            [disabled]="!state.selectedEnvironment() || !connected()"
            (click)="openStageTracker.emit()"
          >
            <app-icon name="file-search" size="14" />
            Stage Tracker
          </button>
        </div>

        <div class="toolbar-btn-group" (mouseenter)="onGroupHover('s3-transfer', $event)" (mouseleave)="scheduleLeave()">
          <button
            class="btn"
            [disabled]="!state.selectedEnvironment() || !connected()"
            (click)="openS3Transfer.emit()"
          >
            <app-icon name="download" size="14" />
            S3 Transfer
          </button>
        </div>

        <div class="toolbar-btn-group" (mouseenter)="onGroupHover('s3-explorer', $event)" (mouseleave)="scheduleLeave()">
          <button
            class="btn"
            [disabled]="!state.selectedEnvironment() || !connected()"
            (click)="openS3Explorer.emit()"
          >
            <app-icon name="cloud" size="14" />
            S3 Explorer
          </button>
        </div>

        <div class="toolbar-sep"></div>
        <button class="btn icon-btn" title="Settings" (click)="openSettings.emit()">
          <app-icon name="settings" size="16" />
        </button>
      </div>

      @if (hoverType && dropdownPos) {
        <div
          class="toolbar-existing-dropdown"
          [style.top.px]="dropdownPos.top"
          [style.left.px]="dropdownPos.left"
          (mouseenter)="cancelScheduledLeave()"
          (mouseleave)="scheduleLeave()"
        >
          <button class="toolbar-existing-item toolbar-existing-item-new" type="button" (click)="addTab(hoverType)">
            <app-icon name="plus" size="12" />
            New {{ hoverLabel(hoverType) }} tab
          </button>
          @if (existingTabsOf(hoverType).length > 0) {
            <div class="toolbar-existing-divider"></div>
            <div class="toolbar-existing-header">Open {{ hoverLabel(hoverType) }} tabs</div>
            @for (t of existingTabsOf(hoverType); track t.id) {
              <button class="toolbar-existing-item" type="button" (click)="activateTab.emit(t.id)">{{ t.title }}</button>
            }
          }
        </div>
      }
    </header>
  `
})
export class ToolbarComponent {
  @Input() tabs: Tab[] = [];
  @Output() newTerminal = new EventEmitter<void>();
  @Output() openFiles = new EventEmitter<void>();
  @Output() openQuickExecute = new EventEmitter<void>();
  @Output() openSettings = new EventEmitter<void>();
  @Output() openApplications = new EventEmitter<void>();
  @Output() openStageTracker = new EventEmitter<void>();
  @Output() openS3Transfer = new EventEmitter<void>();
  @Output() openS3Explorer = new EventEmitter<void>();
  @Output() activateTab = new EventEmitter<string>();
  @Output() openAdditionalTab = new EventEmitter<TabType>();

  /** Which button group the pointer is currently over, if any - drives the "already
   * open" preview dropdown so opening a duplicate tab is a deliberate choice made by
   * clicking the button itself, not the only way to get back to one already open. */
  hoverType: TabType | null = null;
  /** Computed from the hovered button group's own bounding rect rather than plain CSS
   * (`position: absolute; top: 100%`) because `.toolbar-actions` scrolls horizontally
   * (`overflow-x: auto`) - per the CSS overflow spec, pairing that with `overflow-y:
   * visible` doesn't actually stay visible, it also computes to `auto`, silently
   * clipping anything meant to overflow below a button. Rendering the dropdown
   * `position: fixed` outside that scroll container, positioned from the real
   * on-screen coordinates, sidesteps the clipping entirely. */
  dropdownPos: { top: number; left: number } | null = null;

  /** The dropdown renders `position: fixed` outside `.toolbar-btn-group` (see
   * dropdownPos), so it's no longer a DOM descendant of the group the pointer just
   * left - moving from the button down into the dropdown is a real mouseleave on the
   * group, not a no-op the way it would be for an absolutely-positioned descendant.
   * Closing on a short delay (cancelled by entering either the group or the dropdown
   * itself) bridges that gap so the dropdown doesn't vanish the instant the pointer
   * starts moving toward it. */
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly hoverLabels: Record<TabType, string> = {
    terminal: 'Terminal',
    files: 'Files',
    applications: 'Applications',
    'stage-tracker': 'Stage Tracker',
    's3-transfer': 'S3 Transfer',
    's3-explorer': 'S3 Explorer'
  };

  constructor(public state: AppStateService) {}

  onGroupHover(type: TabType, event: MouseEvent): void {
    this.cancelScheduledLeave();
    this.hoverType = type;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dropdownPos = { top: rect.bottom + 4, left: rect.left };
  }

  cancelScheduledLeave(): void {
    if (this.leaveTimer) {
      clearTimeout(this.leaveTimer);
      this.leaveTimer = null;
    }
  }

  scheduleLeave(): void {
    this.cancelScheduledLeave();
    this.leaveTimer = setTimeout(() => {
      this.hoverType = null;
      this.dropdownPos = null;
    }, 200);
  }

  hoverLabel(type: TabType): string {
    return this.hoverLabels[type];
  }

  addTab(type: TabType): void {
    this.openAdditionalTab.emit(type);
    this.hoverType = null;
    this.dropdownPos = null;
  }

  /** Tabs of this type for the currently selected environment - what clicking the
   * matching toolbar button would add another one of. */
  existingTabsOf(type: TabType): Tab[] {
    const envId = this.state.selectedEnvironmentId();
    if (!envId) return [];
    return this.tabs.filter((t) => t.type === type && t.environmentId === envId);
  }

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
