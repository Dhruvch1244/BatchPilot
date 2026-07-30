import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../shared/modal.component';
import { AppStateService } from '../core/app-state.service';
import { Environment, EnvironmentRequest, EnvironmentType } from '../core/models';

@Component({
  selector: 'app-environment-form-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal [title]="editing ? 'Edit Environment' : 'New Environment'" (close)="close.emit()">
      <form class="form" (ngSubmit)="submit()">
        <label class="form-field">
          <span>Name</span>
          <input name="name" [(ngModel)]="name" required autofocus />
        </label>

        <label class="form-field">
          <span>Type</span>
          <select name="type" [(ngModel)]="type">
            <option value="DEV">DEV</option>
            <option value="UAT">UAT</option>
            <option value="CUSTOM">CUSTOM</option>
          </select>
        </label>

        <label class="form-field">
          <span>Server IP</span>
          <input name="serverIp" [(ngModel)]="serverIp" placeholder="10.0.0.5" required />
        </label>

        <label class="form-field">
          <span>SSH Port</span>
          <input name="sshPort" type="number" min="1" max="65535" [(ngModel)]="sshPort" required />
        </label>

        <label class="form-field">
          <span>PPK Path</span>
          <input name="ppkPath" [(ngModel)]="ppkPath" placeholder="/path/to/key.ppk" required />
        </label>

        <label class="form-field">
          <span>Username</span>
          <input name="username" [value]="environment?.username ?? 'hadoop'" disabled />
        </label>

        @if (formError) {
          <div class="form-error">{{ formError }}</div>
        }

        <div class="form-actions">
          <button type="button" class="btn" (click)="close.emit()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="submitting">
            {{ editing ? 'Save' : 'Create' }}
          </button>
        </div>
      </form>
    </app-modal>
  `
})
export class EnvironmentFormModalComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() environment?: Environment;
  @Output() close = new EventEmitter<void>();

  name = '';
  type: EnvironmentType = 'CUSTOM';
  serverIp = '';
  sshPort = 22;
  ppkPath = '';
  submitting = false;
  formError: string | null = null;

  constructor(private state: AppStateService) {}

  get editing(): boolean {
    return this.mode === 'edit';
  }

  ngOnInit(): void {
    if (this.environment) {
      this.name = this.environment.name;
      this.type = this.environment.type;
      this.serverIp = this.environment.serverIp;
      this.sshPort = this.environment.sshPort;
      this.ppkPath = this.environment.ppkPath;
    }
  }

  async submit(): Promise<void> {
    this.formError = null;
    this.submitting = true;
    const request: EnvironmentRequest = {
      name: this.name,
      type: this.type,
      serverIp: this.serverIp,
      sshPort: Number(this.sshPort),
      ppkPath: this.ppkPath
    };
    try {
      if (this.editing && this.environment) {
        await this.state.updateEnvironment(this.environment.id, request);
      } else {
        await this.state.createEnvironment(request);
      }
      this.close.emit();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : 'Failed to save environment';
    } finally {
      this.submitting = false;
    }
  }
}
