import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal" [style.width.px]="width" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <span>{{ title }}</span>
          <button class="icon-btn" type="button" (click)="close.emit()">✕</button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `
})
export class ModalComponent {
  @Input() title = '';
  @Input() width = 480;
  @Output() close = new EventEmitter<void>();
}
