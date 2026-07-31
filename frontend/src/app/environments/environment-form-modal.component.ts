import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ModalComponent } from '../shared/modal.component';
import { IconComponent } from '../shared/icon.component';
import { ApiService } from '../core/api.service';
import { AppStateService } from '../core/app-state.service';
import { Environment, EnvironmentRequest, EnvironmentType } from '../core/models';

@Component({
  selector: 'app-environment-form-modal',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent],
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

        <div class="form-field">
          <span>PPK Path</span>
          <input name="ppkPath" [(ngModel)]="ppkPath" placeholder="/path/to/key.ppk" required />

          <div
            class="key-dropzone"
            [class.key-dropzone-active]="dragOver"
            (click)="fileInput.click()"
            (dragover)="onDragOver($event)"
            (dragleave)="dragOver = false"
            (drop)="onDrop($event)"
          >
            <input #fileInput type="file" accept=".ppk" hidden (change)="onFileSelected($event)" />
            @if (uploading) {
              <app-icon name="refresh" size="15" [spin]="true" />
              <span>Uploading {{ pendingFileName }}…</span>
            } @else if (uploadedFileName) {
              <app-icon name="check-circle" size="15" />
              <span>Using {{ uploadedFileName }} — drop another .ppk to replace it</span>
            } @else {
              <app-icon name="folder" size="15" />
              <span>Drop a .ppk file here, or click to browse</span>
            }
          </div>
          @if (uploadError) {
            <div class="form-error">{{ uploadError }}</div>
          }
        </div>

        <label class="form-field">
          <span>Username</span>
          <input name="username" [value]="environment?.username ?? 'hadoop'" disabled />
        </label>

        <button type="button" class="advanced-toggle" (click)="showAdvanced = !showAdvanced">
          <app-icon name="chevron-up" size="12" [style.transform]="showAdvanced ? 'rotate(0deg)' : 'rotate(180deg)'" />
          Advanced
        </button>

        @if (showAdvanced) {
          <label class="form-field">
            <span>YARN ResourceManager URL (optional)</span>
            <input
              name="yarnRmUrl"
              [(ngModel)]="yarnRmUrl"
              placeholder="http://ip-10-0-0-5.ec2.internal:8088"
            />
            <span class="form-hint">
              Lets Applications/Stage Tracker fetch YARN app data via the RM's own REST API instead of over SSH — much
              faster when reachable. Leave blank to auto-derive from the Server IP above
              (ip-a-b-c-d.ec2.internal:8088); falls back to SSH automatically either way.
            </span>
          </label>
        }

        @if (formError) {
          <div class="form-error">{{ formError }}</div>
        }

        <div class="form-actions">
          <button type="button" class="btn" (click)="close.emit()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="submitting || uploading">
            {{ editing ? 'Save' : 'Create' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: [`
    .key-dropzone {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      padding: 10px 12px;
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-md);
      background: var(--bg-panel-alt);
      color: var(--text-dim);
      font-size: 12px;
      cursor: pointer;
      transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
    }
    .key-dropzone:hover { border-color: var(--accent); color: var(--text); }
    .key-dropzone-active {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 10%, var(--bg-panel-alt));
      color: var(--text);
    }
    .advanced-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      background: none;
      border: none;
      padding: 4px 0;
      color: var(--text-dim);
      font-size: 12px;
      cursor: pointer;
      transition: color 0.12s ease;
    }
    .advanced-toggle:hover { color: var(--text); }
    .form-hint {
      display: block;
      margin-top: 6px;
      color: var(--text-dim);
      font-size: 11px;
      line-height: 1.5;
    }
  `]
})
export class EnvironmentFormModalComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() environment?: Environment;
  @Output() close = new EventEmitter<void>();

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  name = '';
  type: EnvironmentType = 'CUSTOM';
  serverIp = '';
  sshPort = 22;
  ppkPath = '';
  yarnRmUrl = '';
  showAdvanced = false;
  submitting = false;
  formError: string | null = null;

  dragOver = false;
  uploading = false;
  uploadError: string | null = null;
  pendingFileName = '';
  /** Set once a key has actually been uploaded through the dropper this session (not
   * just typed as a path), so the hint reflects "you picked a file" rather than
   * restating whatever ppkPath happens to already contain when editing. */
  uploadedFileName = '';

  constructor(private state: AppStateService, private api: ApiService) {}

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
      this.yarnRmUrl = this.environment.yarnRmUrl ?? '';
      this.showAdvanced = !!this.yarnRmUrl;
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadKey(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploadKey(file);
    input.value = '';
  }

  private async uploadKey(file: File): Promise<void> {
    this.uploading = true;
    this.uploadError = null;
    this.pendingFileName = file.name;
    try {
      const result = await firstValueFrom(this.api.uploadKeyFile(file));
      this.ppkPath = result.path;
      this.uploadedFileName = file.name;
    } catch (e) {
      this.uploadError = e instanceof Error ? e.message : 'Failed to upload key file';
    } finally {
      this.uploading = false;
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
      ppkPath: this.ppkPath,
      yarnRmUrl: this.yarnRmUrl.trim() || undefined
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
