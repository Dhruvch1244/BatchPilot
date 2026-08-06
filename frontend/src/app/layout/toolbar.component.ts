import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
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

        <div class="toolbar-btn-group">
          <button class="btn toolbar-group-main" [disabled]="!state.selectedEnvironment()" (click)="newTerminal.emit()">
            <app-icon name="terminal" size="14" />
            Terminal
          </button>
          <button
            class="btn toolbar-group-toggle"
            [class.toolbar-group-toggle-active]="dropdownType === 'terminal'"
            [disabled]="!state.selectedEnvironment()"
            title="Open Terminal tabs"
            (click)="toggleDropdown('terminal', $event)"
          >
            <app-icon name="chevron-down" size="12" />
          </button>
        </div>

        <div class="toolbar-btn-group">
          <button class="btn toolbar-group-main" [disabled]="!state.selectedEnvironment() || !connected()" (click)="openFiles.emit()">
            <app-icon name="folder" size="14" />
            Files
          </button>
          <button
            class="btn toolbar-group-toggle"
            [class.toolbar-group-toggle-active]="dropdownType === 'files'"
            [disabled]="!state.selectedEnvironment() || !connected()"
            title="Open Files tabs"
            (click)="toggleDropdown('files', $event)"
          >
            <app-icon name="chevron-down" size="12" />
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

        <div class="toolbar-btn-group">
          <button
            class="btn toolbar-group-main"
            [disabled]="!state.selectedEnvironment() || !connected()"
            (click)="openApplications.emit()"
          >
            <app-icon name="activity" size="14" />
            Applications
          </button>
          <button
            class="btn toolbar-group-toggle"
            [class.toolbar-group-toggle-active]="dropdownType === 'applications'"
            [disabled]="!state.selectedEnvironment() || !connected()"
            title="Open Applications tabs"
            (click)="toggleDropdown('applications', $event)"
          >
            <app-icon name="chevron-down" size="12" />
          </button>
        </div>

        <div class="toolbar-btn-group">
          <button
            class="btn toolbar-group-main"
            [disabled]="!state.selectedEnvironment() || !connected()"
            (click)="openStageTracker.emit()"
          >
            <app-icon name="file-search" size="14" />
            Stage Tracker
          </button>
          <button
            class="btn toolbar-group-toggle"
            [class.toolbar-group-toggle-active]="dropdownType === 'stage-tracker'"
            [disabled]="!state.selectedEnvironment() || !connected()"
            title="Open Stage Tracker tabs"
            (click)="toggleDropdown('stage-tracker', $event)"
          >
            <app-icon name="chevron-down" size="12" />
          </button>
        </div>

        <div class="toolbar-btn-group">
          <button
            class="btn toolbar-group-main"
            [disabled]="!state.selectedEnvironment() || !connected()"
            (click)="openS3Transfer.emit()"
          >
            <app-icon name="download" size="14" />
            S3 Transfer
          </button>
          <button
            class="btn toolbar-group-toggle"
            [class.toolbar-group-toggle-active]="dropdownType === 's3-transfer'"
            [disabled]="!state.selectedEnvironment() || !connected()"
            title="Open S3 Transfer tabs"
            (click)="toggleDropdown('s3-transfer', $event)"
          >
            <app-icon name="chevron-down" size="12" />
          </button>
        </div>

        <div class="toolbar-btn-group">
          <button
            class="btn toolbar-group-main"
            [disabled]="!state.selectedEnvironment() || !connected()"
            (click)="openS3Explorer.emit()"
          >
            <app-icon name="cloud" size="14" />
            S3 Explorer
          </button>
          <button
            class="btn toolbar-group-toggle"
            [class.toolbar-group-toggle-active]="dropdownType === 's3-explorer'"
            [disabled]="!state.selectedEnvironment() || !connected()"
            title="Open S3 Explorer tabs"
            (click)="toggleDropdown('s3-explorer', $event)"
          >
            <app-icon name="chevron-down" size="12" />
          </button>
        </div>

        <div class="toolbar-sep"></div>
        <button class="btn icon-btn" title="Settings" (click)="openSettings.emit()">
          <app-icon name="settings" size="16" />
        </button>
      </div>

      @if (dropdownType && dropdownPos) {
        <div class="toolbar-existing-dropdown" [style.top.px]="dropdownPos.top" [style.left.px]="dropdownPos.left" (click)="$event.stopPropagation()">
          <button class="toolbar-existing-item toolbar-existing-item-new" type="button" (click)="addTab(dropdownType)">
            <app-icon name="plus" size="12" />
            New {{ hoverLabel(dropdownType) }} tab
          </button>
          @if (existingTabsOf(dropdownType).length > 0) {
            <div class="toolbar-existing-divider"></div>
            <div class="toolbar-existing-header">Open {{ hoverLabel(dropdownType) }} tabs</div>
            @for (t of existingTabsOf(dropdownType); track t.id) {
              <button class="toolbar-existing-item" type="button" (click)="selectTab(t.id)">{{ t.title }}</button>
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

  /** Which button group's dropdown is currently open, if any - a real click-to-toggle
   * (not hover) so it behaves like ag-grid's column-menu hamburger: click the chevron to
   * open, click it again (or anywhere else) to close, no risk of a quick click opening
   * and immediately closing again as it would with a hover/mouseleave-driven menu (the
   * click's own default action - e.g. opening a new tab - can shift the layout enough to
   * slide the button out from under the pointer, firing mouseleave before the menu is
   * even visible; only "holding" the mouse still avoided that, which is what prompted
   * this rewrite). */
  dropdownType: TabType | null = null;
  /** Computed from the toggle button's own bounding rect rather than plain CSS
   * (`position: absolute; top: 100%`) because `.toolbar-actions` scrolls horizontally
   * (`overflow-x: auto`) - per the CSS overflow spec, pairing that with `overflow-y:
   * visible` doesn't actually stay visible, it also computes to `auto`, silently
   * clipping anything meant to overflow below a button. Rendering the dropdown
   * `position: fixed` outside that scroll container, positioned from the real
   * on-screen coordinates, sidesteps the clipping entirely. */
  dropdownPos: { top: number; left: number } | null = null;

  private readonly hoverLabels: Record<TabType, string> = {
    terminal: 'Terminal',
    files: 'Files',
    applications: 'Applications',
    'stage-tracker': 'Stage Tracker',
    's3-transfer': 'S3 Transfer',
    's3-explorer': 'S3 Explorer'
  };

  constructor(public state: AppStateService) {}

  toggleDropdown(type: TabType, event: MouseEvent): void {
    event.stopPropagation();
    if (this.dropdownType === type) {
      this.closeDropdown();
      return;
    }
    this.dropdownType = type;
    const group = (event.currentTarget as HTMLElement).closest('.toolbar-btn-group') as HTMLElement;
    const rect = group.getBoundingClientRect();
    this.dropdownPos = { top: rect.bottom + 4, left: rect.left };
  }

  closeDropdown(): void {
    this.dropdownType = null;
    this.dropdownPos = null;
  }

  /** Closes the dropdown on any click outside it - the dropdown's own content stops
   * propagation (see the template) so this only ever fires for genuine outside clicks,
   * including the toggle button's own click while the dropdown is already open (that
   * case is handled directly in toggleDropdown, which also stops propagation). */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeDropdown();
  }

  hoverLabel(type: TabType): string {
    return this.hoverLabels[type];
  }

  addTab(type: TabType): void {
    this.openAdditionalTab.emit(type);
    this.closeDropdown();
  }

  selectTab(id: string): void {
    this.activateTab.emit(id);
    this.closeDropdown();
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
