import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Tab } from '../core/models';

@Component({
  selector: 'app-tab-strip',
  standalone: true,
  template: `
    <div class="tab-strip">
      @for (tab of tabs; track tab.id) {
        <div
          class="tab-strip-item"
          [class.tab-strip-item-active]="tab.id === activeTabId"
          (click)="select.emit(tab.id)"
        >
          <span class="tab-strip-icon">{{ tab.type === 'terminal' ? '⌨' : '📁' }}</span>
          <span class="tab-strip-title">{{ tab.title }}</span>
          <button class="tab-strip-close" type="button" (click)="onClose($event, tab.id)">✕</button>
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
}
