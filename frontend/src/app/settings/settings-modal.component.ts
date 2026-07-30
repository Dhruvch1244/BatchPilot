import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../shared/modal.component';
import { AppStateService } from '../core/app-state.service';
import { AppSettings } from '../core/models';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal title="Settings" (close)="close.emit()">
      <div class="form">
        <label class="form-field">
          <span>Font Size</span>
          <input type="number" min="8" max="32" [(ngModel)]="form.fontSize" />
        </label>

        <label class="form-field">
          <span>Theme</span>
          <select [(ngModel)]="form.theme">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <label class="form-field form-field-row">
          <span>Auto-reconnect</span>
          <input type="checkbox" [(ngModel)]="form.autoReconnect" />
        </label>

        <label class="form-field">
          <span>Reconnect interval (seconds)</span>
          <input type="number" min="1" max="120" [(ngModel)]="form.reconnectIntervalSeconds" [disabled]="!form.autoReconnect" />
        </label>

        <label class="form-field">
          <span>Max reconnect attempts</span>
          <input type="number" min="1" max="50" [(ngModel)]="form.maxReconnectAttempts" [disabled]="!form.autoReconnect" />
        </label>

        <label class="form-field">
          <span>Max terminal tabs</span>
          <input type="number" min="1" max="50" [(ngModel)]="form.maxTabs" />
        </label>

        <label class="form-field">
          <span>Max upload size (MB)</span>
          <input type="number" min="1" [(ngModel)]="form.maxUploadSizeMb" />
        </label>

        @if (error) {
          <div class="form-error">{{ error }}</div>
        }

        <div class="form-actions">
          <button class="btn" type="button" (click)="close.emit()">Cancel</button>
          <button class="btn btn-primary" type="button" [disabled]="saving" (click)="save()">Save</button>
        </div>
      </div>
    </app-modal>
  `
})
export class SettingsModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  form!: AppSettings;
  saving = false;
  error: string | null = null;

  constructor(private state: AppStateService) {}

  ngOnInit(): void {
    this.form = { ...this.state.settings() };
  }

  async save(): Promise<void> {
    this.saving = true;
    this.error = null;
    try {
      await this.state.updateSettings(this.form);
      this.close.emit();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      this.saving = false;
    }
  }
}
