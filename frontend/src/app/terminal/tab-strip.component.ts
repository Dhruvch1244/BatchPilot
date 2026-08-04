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
          [class.tab-strip-item-dragging]="draggingId === tab.id"
          [class.tab-strip-item-drag-over]="dragOverId === tab.id && draggingId !== tab.id"
          draggable="true"
          (click)="select.emit(tab.id)"
          (dragstart)="onDragStart($event, tab.id)"
          (dragover)="onDragOver($event, tab.id)"
          (dragleave)="onDragLeave(tab.id)"
          (drop)="onDrop($event, tab.id)"
          (dragend)="onDragEnd()"
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
  /** Emits the full tab list in its new order once a drag-and-drop reorder completes -
   * the parent just needs to store it back, no index math on its end. */
  @Output() reorder = new EventEmitter<Tab[]>();

  draggingId: string | null = null;
  dragOverId: string | null = null;

  onClose(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.close.emit(id);
  }

  tabIcon(type: TabType): IconName {
    return TAB_ICONS[type];
  }

  onDragStart(event: DragEvent, id: string): void {
    this.draggingId = id;
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent, id: string): void {
    // Required for `drop` to fire at all - browsers reject drops on elements whose
    // dragover handler doesn't call preventDefault().
    event.preventDefault();
    if (this.draggingId && this.draggingId !== id) {
      this.dragOverId = id;
    }
  }

  onDragLeave(id: string): void {
    if (this.dragOverId === id) {
      this.dragOverId = null;
    }
  }

  onDrop(event: DragEvent, targetId: string): void {
    event.preventDefault();
    const draggedId = this.draggingId;
    this.draggingId = null;
    this.dragOverId = null;
    if (!draggedId || draggedId === targetId) return;

    const reordered = [...this.tabs];
    const fromIndex = reordered.findIndex((t) => t.id === draggedId);
    const toIndex = reordered.findIndex((t) => t.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    this.reorder.emit(reordered);
  }

  onDragEnd(): void {
    this.draggingId = null;
    this.dragOverId = null;
  }
}
