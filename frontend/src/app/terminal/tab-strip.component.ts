import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Tab, TabType } from '../core/models';
import { IconComponent, IconName } from '../shared/icon.component';

const TAB_ICONS: Record<TabType, IconName> = {
  terminal: 'terminal',
  files: 'folder',
  applications: 'activity',
  'stage-tracker': 'file-search',
  's3-transfer': 'download',
  's3-explorer': 'cloud'
};

@Component({
  selector: 'app-tab-strip',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="tab-strip">
      @for (tab of tabs; track tab.id) {
        <div
          class="tab-strip-item"
          [class.tab-strip-item-active]="tab.id === activeTabId"
          (click)="select.emit(tab.id)"
        >
          <span class="tab-strip-icon">
            <app-icon [name]="tabIcon(tab.type)" size="13" />
          </span>
          <span class="tab-strip-title">{{ tab.title }}</span>
          <button class="tab-strip-close" type="button" (click)="onClose($event, tab.id)">
            <app-icon name="close" size="12" />
          </button>
        </div>
      }
    </div>
  `
})
export class TabStripComponent {
  @Input({ required: true }) tabs: Tab[] = [];
  @Input() activeTabId: string | null = null;
  @Output() select = new EventEmitter<string>();
  @Output() close = new EventEmitter<string>();

  onClose(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.close.emit(id);
  }

  tabIcon(type: TabType): IconName {
    return TAB_ICONS[type];
  }
}
