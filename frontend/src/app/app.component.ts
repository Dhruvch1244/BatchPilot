import { Component, OnInit } from '@angular/core';
import { AppStateService } from './core/app-state.service';
import { Environment, Tab } from './core/models';
import { ToolbarComponent } from './layout/toolbar.component';
import { SidebarComponent } from './layout/sidebar.component';
import { StatusBarComponent } from './layout/status-bar.component';
import { TabStripComponent } from './terminal/tab-strip.component';
import { TerminalTabComponent } from './terminal/terminal-tab.component';
import { FileManagerPanelComponent } from './file-manager/file-manager-panel.component';
import { QuickExecutePanelComponent } from './quick-execute/quick-execute-panel.component';
import { SettingsModalComponent } from './settings/settings-modal.component';
import { EnvironmentFormModalComponent } from './environments/environment-form-modal.component';
import { ApplicationsPanelComponent } from './applications/applications-panel.component';
import { StageTrackerPanelComponent } from './stage-tracker/stage-tracker-panel.component';
import { S3TransferPanelComponent } from './s3-transfer/s3-transfer-panel.component';

export type EnvironmentFormState = { mode: 'create' } | { mode: 'edit'; environment: Environment } | null;

let tabCounter = 0;
function nextTabId(): string {
  tabCounter += 1;
  return `tab-${Date.now()}-${tabCounter}`;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ToolbarComponent,
    SidebarComponent,
    StatusBarComponent,
    TabStripComponent,
    TerminalTabComponent,
    FileManagerPanelComponent,
    QuickExecutePanelComponent,
    SettingsModalComponent,
    EnvironmentFormModalComponent,
    ApplicationsPanelComponent,
    StageTrackerPanelComponent,
    S3TransferPanelComponent
  ],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  tabs: Tab[] = [];
  activeTabId: string | null = null;
  quickExecuteOpen = false;
  settingsOpen = false;
  environmentForm: EnvironmentFormState = null;

  constructor(public state: AppStateService) {}

  ngOnInit(): void {
    this.state.init();
  }

  openTerminalTab(environmentId: string): void {
    const terminalTabCount = this.tabs.filter((t) => t.type === 'terminal').length;
    if (terminalTabCount >= this.state.settings().maxTabs) {
      window.alert(
        `Maximum of ${this.state.settings().maxTabs} terminal tabs reached. Close a tab or raise the limit in Settings.`
      );
      return;
    }
    const env = this.state.environments().find((e) => e.id === environmentId);
    const id = nextTabId();
    const title = `${env?.name ?? 'Terminal'} #${terminalTabCount + 1}`;
    this.tabs = [...this.tabs, { id, type: 'terminal', environmentId, title }];
    this.activeTabId = id;
  }

  openFilesTab(environmentId: string): void {
    this.openSingletonTab(environmentId, 'files', (env) => `${env?.name ?? 'Files'} — Explorer`);
  }

  openApplicationsTab(environmentId: string): void {
    this.openSingletonTab(environmentId, 'applications', (env) => `${env?.name ?? 'Applications'} — YARN`);
  }

  openStageTrackerTab(environmentId: string): void {
    this.openSingletonTab(environmentId, 'stage-tracker', (env) => `${env?.name ?? 'Stage Tracker'} — Stages`);
  }

  openS3TransferTab(environmentId: string): void {
    this.openSingletonTab(environmentId, 's3-transfer', (env) => `${env?.name ?? 'S3 Transfer'} — Staging`);
  }

  private openSingletonTab(environmentId: string, type: Tab['type'], titleFor: (env?: Environment) => string): void {
    const existing = this.tabs.find((t) => t.type === type && t.environmentId === environmentId);
    if (existing) {
      this.activeTabId = existing.id;
      return;
    }
    const env = this.state.environments().find((e) => e.id === environmentId);
    const id = nextTabId();
    this.tabs = [...this.tabs, { id, type, environmentId, title: titleFor(env) }];
    this.activeTabId = id;
  }

  closeTab(id: string): void {
    const next = this.tabs.filter((t) => t.id !== id);
    if (this.activeTabId === id) {
      this.activeTabId = next.length > 0 ? next[next.length - 1].id : null;
    }
    this.tabs = next;
  }

  async handleNewTerminal(): Promise<void> {
    const envId = this.state.selectedEnvironmentId();
    if (!envId) return;
    if (this.state.statuses()[envId]?.state !== 'CONNECTED') {
      await this.state.connect(envId);
    }
    this.openTerminalTab(envId);
  }

  openFilesForSelected(): void {
    const envId = this.state.selectedEnvironmentId();
    if (envId) this.openFilesTab(envId);
  }

  openApplicationsForSelected(): void {
    const envId = this.state.selectedEnvironmentId();
    if (envId) this.openApplicationsTab(envId);
  }

  openStageTrackerForSelected(): void {
    const envId = this.state.selectedEnvironmentId();
    if (envId) this.openStageTrackerTab(envId);
  }

  openS3TransferForSelected(): void {
    const envId = this.state.selectedEnvironmentId();
    if (envId) this.openS3TransferTab(envId);
  }

  openCreateForm(): void {
    this.environmentForm = { mode: 'create' };
  }

  openEditForm(env: Environment): void {
    this.environmentForm = { mode: 'edit', environment: env };
  }
}
