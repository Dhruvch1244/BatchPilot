import { Component, OnInit, effect } from '@angular/core';
import { AppStateService } from './core/app-state.service';
import { Environment, Tab, TabType } from './core/models';
import { UI_FONT_OPTIONS, fontStackFor } from './core/font-catalog';
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
import { S3ExplorerPanelComponent } from './s3-explorer/s3-explorer-panel.component';
import { OnboardingWizardComponent } from './onboarding/onboarding-wizard.component';
import { IconComponent, IconName } from './shared/icon.component';

export type EnvironmentFormState = { mode: 'create' } | { mode: 'edit'; environment: Environment } | null;

let tabCounter = 0;
function nextTabId(): string {
  tabCounter += 1;
  return `tab-${Date.now()}-${tabCounter}`;
}

interface FeatureCard {
  type: TabType | 'quick-execute';
  icon: IconName;
  title: string;
  description: string;
}

const FEATURES: FeatureCard[] = [
  { type: 'terminal', icon: 'terminal', title: 'Terminal', description: 'Full interactive SSH shell, any number of tabs at once.' },
  { type: 'files', icon: 'folder', title: 'File Manager', description: 'Browse, upload, download, and deep-search remote files.' },
  { type: 'quick-execute', icon: 'play', title: 'Quick Execute', description: 'Run a one-off command without opening a terminal.' },
  { type: 'applications', icon: 'activity', title: 'Applications', description: 'Live YARN application list, grouped and searchable.' },
  { type: 'stage-tracker', icon: 'file-search', title: 'Stage Tracker', description: 'Follow a file through the pipeline, stage by stage.' },
  { type: 's3-transfer', icon: 'download', title: 'S3 Transfer', description: 'Stage a file to S3 with a generated aws s3 cp command.' },
  { type: 's3-explorer', icon: 'cloud', title: 'S3 Explorer', description: 'Browse, upload, and download S3 objects, paginated for huge buckets.' }
];

// figlet "slant" rendering of "BatchPilot" - colored via a CSS gradient
// (background-clip: text) on the <pre> itself, see .ascii-logo in styles.css.
const ASCII_LOGO = [
  '    ____        __       __    ____  _ __      __ ',
  '   / __ )____ _/ /______/ /_  / __ \\(_) /___  / /_',
  '  / __  / __ `/ __/ ___/ __ \\/ /_/ / / / __ \\/ __/',
  ' / /_/ / /_/ / /_/ /__/ / / / ____/ / / /_/ / /_  ',
  '/_____/\\__,_/\\__/\\___/_/ /_/_/   /_/_/\\____/\\__/  '
].join('\n');

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
    S3TransferPanelComponent,
    S3ExplorerPanelComponent,
    OnboardingWizardComponent,
    IconComponent
  ],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  tabs: Tab[] = [];
  activeTabId: string | null = null;
  quickExecuteOpen = false;
  settingsOpen = false;
  environmentForm: EnvironmentFormState = null;
  /** Forces the onboarding wizard open regardless of `onboardingCompleted` - set by
   * Settings -> Data & History's "Replay the first-time setup wizard" button. Cleared
   * again once the wizard finishes or is skipped. */
  private onboardingReplayRequested = false;
  /** Read once by a newly created stage-tracker tab's ngOnInit; see
   * openStageTrackerForQuery. */
  pendingStageTrackerQuery = '';

  readonly asciiLogo = ASCII_LOGO;
  readonly features = FEATURES;

  constructor(public state: AppStateService) {
    // Typography is applied globally via CSS custom properties on :root, not scoped to any
    // one component's template - the base `body` rule in styles.css reads these with
    // today's previous hardcoded values as the fallback, so nothing changes for a settings
    // object saved before these fields existed (uiFontFamily defaults to 'system' either way).
    effect(() => {
      const settings = this.state.settings();
      const root = document.documentElement.style;
      root.setProperty('--font-ui', fontStackFor(UI_FONT_OPTIONS, settings.uiFontFamily));
      root.setProperty('--font-size-ui', `${settings.uiFontSizePx}px`);
      root.setProperty('--line-height-ui', `${settings.uiLineHeight}`);
      // Overall UI density: CSS `zoom` on the root, not `.app-shell` - zoom changes what a
      // "CSS pixel" means for everything inside it, and doing that at the true document root
      // is what keeps 100vh/100vw-based layout (the app shell's own full-viewport sizing)
      // consistent, the same way the browser's own native zoom works.
      root.setProperty('--ui-scale', `${settings.uiScalePercent / 100}`);
    });
  }

  ngOnInit(): void {
    this.state.init();
  }

  /** Feature-card click on the empty-state screen: connects the selected environment
   * first if it isn't already (same as the toolbar's own Terminal button), then opens
   * or focuses that feature's tab - Quick Execute is a modal, not a tab, so it's
   * handled separately. */
  async openFeature(type: FeatureCard['type']): Promise<void> {
    const envId = this.state.selectedEnvironmentId();
    if (!envId) return;
    if (type === 'quick-execute') {
      this.quickExecuteOpen = true;
      return;
    }
    if (this.state.statuses()[envId]?.state !== 'CONNECTED') {
      await this.state.connect(envId);
    }
    this.openOrFocus(type, envId);
  }

  /** One title-builder per tab type, shared between the reuse-or-focus click handlers
   * below and openNewTabOfType (the toolbar hover preview's explicit "+" action). */
  private readonly titleFor: Record<TabType, (env: Environment | undefined, n: number) => string> = {
    terminal: (env, n) => `${env?.name ?? 'Terminal'} #${n}`,
    files: (env, n) => `${env?.name ?? 'Files'} — Explorer${n > 1 ? ' #' + n : ''}`,
    applications: (env, n) => `${env?.name ?? 'Applications'} — YARN${n > 1 ? ' #' + n : ''}`,
    'stage-tracker': (env, n) => `${env?.name ?? 'Stage Tracker'} — Stages${n > 1 ? ' #' + n : ''}`,
    's3-transfer': (env, n) => `${env?.name ?? 'S3 Transfer'} — Staging${n > 1 ? ' #' + n : ''}`,
    's3-explorer': (env, n) => `${env?.name ?? 'S3 Explorer'} — Bucket${n > 1 ? ' #' + n : ''}`
  };

  /** Clicking a toolbar button focuses that type's existing tab for this environment if
   * one is already open, rather than piling up a duplicate on every click - opening a
   * second (or third) one on purpose is what the "+" in the toolbar's hover preview is
   * for (see openNewTabOfType). */
  openTerminalTab(environmentId: string): void {
    this.openOrFocus('terminal', environmentId);
  }

  openFilesTab(environmentId: string): void {
    this.openOrFocus('files', environmentId);
  }

  openApplicationsTab(environmentId: string): void {
    this.openOrFocus('applications', environmentId);
  }

  openStageTrackerTab(environmentId: string): void {
    this.openOrFocus('stage-tracker', environmentId);
  }

  openS3TransferTab(environmentId: string): void {
    this.openOrFocus('s3-transfer', environmentId);
  }

  openS3ExplorerTab(environmentId: string): void {
    this.openOrFocus('s3-explorer', environmentId);
  }

  private openOrFocus(type: TabType, environmentId: string): void {
    const existing = this.tabs.find((t) => t.type === type && t.environmentId === environmentId);
    if (existing) {
      this.activeTabId = existing.id;
      return;
    }
    this.openNewTabOfType(type, environmentId);
  }

  /** Always adds another tab of this type, even if one is already open - bound to the
   * "+" action in the toolbar's hover preview dropdown. */
  openNewTabOfType(type: TabType, environmentId?: string): void {
    const envId = environmentId ?? this.state.selectedEnvironmentId();
    if (!envId) return;
    if (type === 'terminal') {
      const terminalTabCount = this.tabs.filter((t) => t.type === 'terminal').length;
      if (terminalTabCount >= this.state.settings().maxTabs) {
        window.alert(
          `Maximum of ${this.state.settings().maxTabs} terminal tabs reached. Close a tab or raise the limit in Settings.`
        );
        return;
      }
    }
    this.openTab(envId, type, this.titleFor[type]);
  }

  /** Applications rows navigate here with a filename extracted from the YARN app name.
   * Always opens a fresh Stage Tracker tab, titled with the query itself so it's
   * immediately identifiable among any other Stage Tracker tabs already open — existing
   * tabs (and whatever they're mid-searching) are left alone rather than closed, now
   * that multiple tabs of the same type are allowed. */
  openStageTrackerForQuery(environmentId: string, query: string): void {
    this.pendingStageTrackerQuery = query;
    this.openTab(environmentId, 'stage-tracker', (env) => `${env?.name ?? 'Stage Tracker'} — ${query}`);
  }

  /** Every panel type can now have multiple tabs open at once (per environment); each
   * gets a numbered title (`Files — Explorer #2`) so tabs of the same type stay
   * distinguishable in the tab strip - see also the toolbar's hover preview, which
   * lists already-open tabs of a type so opening a duplicate is a deliberate choice,
   * not the only option. */
  private openTab(environmentId: string, type: Tab['type'], titleFor: (env: Environment | undefined, n: number) => string): void {
    const n = this.tabs.filter((t) => t.type === type && t.environmentId === environmentId).length + 1;
    const env = this.state.environments().find((e) => e.id === environmentId);
    const id = nextTabId();
    this.tabs = [...this.tabs, { id, type, environmentId, title: titleFor(env, n), ordinal: n }];
    this.activeTabId = id;
  }

  activateTab(id: string): void {
    this.activeTabId = id;
  }

  renameTab(tabId: string, title: string): void {
    this.tabs = this.tabs.map((t) => (t.id === tabId ? { ...t, title } : t));
  }

  /** Appends this tab's original "#2"-style ordinal suffix (if any) so a dynamic title
   * update never loses the thing that made it distinguishable from a sibling tab in
   * the first place - e.g. two Files tabs that both happen to browse to the same
   * folder should still read "... — /data" and "... — /data #2", not the same title
   * twice. */
  private withOrdinalSuffix(tab: Tab, label: string): string {
    return tab.ordinal > 1 ? `${label} #${tab.ordinal}` : label;
  }

  /** Keeps a Files tab's title showing wherever it's currently browsing, so multiple
   * Files tabs for the same environment stay distinguishable at a glance instead of
   * all reading identically. */
  onFilesPathChange(tabId: string, path: string): void {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const env = this.state.environments().find((e) => e.id === tab.environmentId);
    const label = path === '.' || path === '/' ? 'Explorer' : path;
    this.renameTab(tabId, `${env?.name ?? 'Files'} — ${this.withOrdinalSuffix(tab, label)}`);
  }

  /** Same idea as onFilesPathChange, but for what a Stage Tracker tab is currently
   * searching. */
  onStageTrackerQueryChange(tabId: string, query: string): void {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab || !query.trim()) return;
    const env = this.state.environments().find((e) => e.id === tab.environmentId);
    this.renameTab(tabId, `${env?.name ?? 'Stage Tracker'} — ${this.withOrdinalSuffix(tab, query.trim())}`);
  }

  /** Same idea as onFilesPathChange, but for whatever bucket/prefix an S3 Explorer tab is
   * currently browsing. */
  onS3ExplorerLocationChange(tabId: string, location: string): void {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const env = this.state.environments().find((e) => e.id === tab.environmentId);
    this.renameTab(tabId, `${env?.name ?? 'S3 Explorer'} — ${this.withOrdinalSuffix(tab, location)}`);
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

  openS3ExplorerForSelected(): void {
    const envId = this.state.selectedEnvironmentId();
    if (envId) this.openS3ExplorerTab(envId);
  }

  openCreateForm(): void {
    this.environmentForm = { mode: 'create' };
  }

  openEditForm(env: Environment): void {
    this.environmentForm = { mode: 'edit', environment: env };
  }

  /** True once initial settings have actually loaded (never show the wizard against the
   * placeholder DEFAULT_SETTINGS a fresh signal starts with) and either this is a genuine
   * first launch or Settings -> Data & History explicitly asked to replay it. */
  showOnboarding(): boolean {
    if (this.state.loading()) return false;
    return this.onboardingReplayRequested || !this.state.settings().onboardingCompleted;
  }

  replayOnboarding(): void {
    this.settingsOpen = false;
    this.onboardingReplayRequested = true;
  }

  onOnboardingDone(): void {
    this.onboardingReplayRequested = false;
  }
}
