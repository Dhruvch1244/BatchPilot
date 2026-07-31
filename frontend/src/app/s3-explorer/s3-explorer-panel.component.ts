import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { S3Entry } from '../core/models';
import { IconComponent } from '../shared/icon.component';

type ViewMode = 'table' | 'grid';

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

@Component({
  selector: 'app-s3-explorer-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, IconComponent],
  template: `
    <div
      class="file-manager"
      [class.file-manager-drag]="dragOver"
      (dragover)="onDragOver($event)"
      (dragleave)="dragOver = false"
      (drop)="onDrop($event)"
    >
      <div class="file-manager-toolbar">
        <span class="input-with-icon s3-bucket-field">
          <app-icon name="cloud" size="13" />
          <input
            class="file-manager-path"
            [(ngModel)]="bucket"
            placeholder="$S3_BUCKET (default)"
            title="Bucket name — leave blank to use the environment's default $S3_BUCKET"
            (keydown.enter)="load()"
          />
        </span>
        <button class="btn" type="button" [disabled]="!prefix" (click)="navigateUp()">
          <app-icon name="chevron-up" size="14" /> Up
        </button>
        <input
          class="file-manager-path"
          [(ngModel)]="prefix"
          placeholder="(bucket root)"
          title="Prefix — the S3 'folder' path"
          (keydown.enter)="load()"
        />
        <button class="btn" type="button" (click)="fileInput.click()">Upload</button>
        <input #fileInput type="file" multiple hidden (change)="onFileInputChange($event)" />
        <button class="btn s3-download-btn" type="button" [disabled]="selected.size === 0" (click)="downloadSelected()">
          <app-icon name="download" size="14" /> Download ({{ selected.size }})
        </button>
        <button class="btn" type="button" [disabled]="loading" title="Refresh" (click)="load()">
          <app-icon name="refresh" size="14" [spin]="loading" />
        </button>
        <div class="view-toggle">
          <button type="button" [class.active]="view === 'table'" title="Table view" (click)="view = 'table'"><app-icon name="list" size="15" /></button>
          <button type="button" [class.active]="view === 'grid'" title="Grid view" (click)="view = 'grid'"><app-icon name="grid" size="15" /></button>
        </div>
      </div>

      @if (uploadProgress) {
        <div class="upload-progress">
          <div
            class="upload-progress-bar"
            [style.width.%]="(uploadProgress.loaded / uploadProgress.total) * 100"
          ></div>
        </div>
      }

      @if (error) {
        <div class="form-error">{{ error }}</div>
      }
      @if (loading) {
        <div class="file-manager-loading">Loading…</div>
      }

      @if (!loading) {
        <div class="file-manager-content">
          @if (view === 'table') {
            <table class="file-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Key</th>
                  <th>Size</th>
                  <th>Last Modified</th>
                </tr>
              </thead>
              <tbody>
                @for (entry of entries; track entry.key) {
                  <tr
                    [class.row-selected]="selected.has(entry.key)"
                    (dblclick)="navigateInto(entry)"
                  >
                    <td>
                      @if (!entry.directory) {
                        <input
                          type="checkbox"
                          [checked]="selected.has(entry.key)"
                          (click)="$event.stopPropagation()"
                          (change)="toggleSelect(entry.key)"
                        />
                      }
                    </td>
                    <td class="file-name-cell">
                      <app-icon [name]="entry.directory ? 'folder' : 'file'" size="15" />
                      <span>{{ entry.name }}</span>
                      <button
                        class="icon-btn file-copy-path-btn"
                        type="button"
                        [title]="copiedKey === entry.key ? 'Copied!' : 'Copy S3 path'"
                        (click)="copyS3Uri(entry, $event)"
                      >
                        <app-icon [name]="copiedKey === entry.key ? 'check-circle' : 'duplicate'" size="13" />
                      </button>
                    </td>
                    <td>{{ formatSize(entry.size) }}</td>
                    <td>{{ entry.lastModified ? (entry.lastModified | date: 'medium') : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <div class="file-grid">
              @for (entry of entries; track entry.key) {
                <div
                  class="file-grid-item"
                  [class.row-selected]="selected.has(entry.key)"
                  (click)="!entry.directory && toggleSelect(entry.key)"
                  (dblclick)="navigateInto(entry)"
                >
                  <button
                    class="icon-btn file-copy-path-btn file-grid-copy-path-btn"
                    type="button"
                    [title]="copiedKey === entry.key ? 'Copied!' : 'Copy S3 path'"
                    (click)="copyS3Uri(entry, $event)"
                  >
                    <app-icon [name]="copiedKey === entry.key ? 'check-circle' : 'duplicate'" size="13" />
                  </button>
                  <div class="file-grid-icon"><app-icon [name]="entry.directory ? 'folder' : 'file'" size="28" /></div>
                  <div class="file-grid-name">{{ entry.name }}</div>
                  @if (!entry.directory) {
                    <div class="file-grid-size">{{ formatSize(entry.size) }}</div>
                  }
                </div>
              }
            </div>
          }
          @if (entries.length === 0) {
            <div class="file-manager-search-hint">This prefix is empty.</div>
          }
          @if (nextToken) {
            <div class="s3-load-more">
              <button class="btn" type="button" [disabled]="loadingMore" (click)="loadMore()">
                <app-icon name="refresh" size="13" [spin]="loadingMore" />
                {{ loadingMore ? 'Loading…' : 'Load more' }}
              </button>
              <span class="s3-load-more-count">{{ entries.length }} loaded so far</span>
            </div>
          }
        </div>
      }

      @if (dragOver) {
        <div class="drop-overlay">Drop files to upload to {{ bucket || '$S3_BUCKET' }}:/{{ prefix }}</div>
      }
    </div>
  `
})
export class S3ExplorerPanelComponent implements OnInit {
  @Input({ required: true }) environmentId!: string;
  /** Lets the owning tab keep its title in sync with whatever bucket/prefix this
   * instance is currently browsing. */
  @Output() locationChange = new EventEmitter<string>();

  bucket = '';
  prefix = '';
  entries: S3Entry[] = [];
  nextToken: string | null = null;
  loading = false;
  loadingMore = false;
  error: string | null = null;
  view: ViewMode = 'table';
  selected = new Set<string>();
  dragOver = false;
  uploadProgress: { loaded: number; total: number } | null = null;
  /** Which entry's S3 path was most recently copied, so its button can briefly show a
   * checkmark instead of the copy icon as feedback. */
  copiedKey: string | null = null;
  private copiedKeyTimer?: ReturnType<typeof setTimeout>;

  readonly formatSize = formatSize;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  copyS3Uri(entry: S3Entry, event?: Event): void {
    event?.stopPropagation();
    const uri = this.bucket ? `s3://${this.bucket}/${entry.key}` : entry.key;
    navigator.clipboard.writeText(uri);
    this.copiedKey = entry.key;
    clearTimeout(this.copiedKeyTimer);
    this.copiedKeyTimer = setTimeout(() => {
      if (this.copiedKey === entry.key) this.copiedKey = null;
    }, 1500);
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.selected = new Set();
    try {
      const result = await firstValueFrom(this.api.listS3(this.environmentId, this.bucket, this.prefix));
      this.entries = result.entries;
      this.nextToken = result.nextToken;
      this.emitLocation();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to list bucket';
      this.entries = [];
      this.nextToken = null;
    } finally {
      this.loading = false;
    }
  }

  async loadMore(): Promise<void> {
    if (!this.nextToken || this.loadingMore) return;
    this.loadingMore = true;
    this.error = null;
    try {
      const result = await firstValueFrom(
        this.api.listS3(this.environmentId, this.bucket, this.prefix, this.nextToken)
      );
      this.entries = [...this.entries, ...result.entries];
      this.nextToken = result.nextToken;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load more';
    } finally {
      this.loadingMore = false;
    }
  }

  navigateInto(entry: S3Entry): void {
    if (entry.directory) {
      this.prefix = entry.key;
      this.load();
    }
  }

  navigateUp(): void {
    if (!this.prefix) return;
    const trimmed = this.prefix.replace(/\/+$/, '');
    const idx = trimmed.lastIndexOf('/');
    this.prefix = idx >= 0 ? trimmed.substring(0, idx + 1) : '';
    this.load();
  }

  toggleSelect(key: string): void {
    const next = new Set(this.selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.selected = next;
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    this.uploadFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  async uploadFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;
    this.uploadProgress = { loaded: 0, total: 1 };
    try {
      await new Promise<void>((resolve, reject) => {
        this.api.uploadS3(this.environmentId, this.bucket, this.prefix, files).subscribe({
          next: (progress) => {
            this.uploadProgress = { loaded: progress.loaded, total: progress.total };
            if (progress.done) resolve();
          },
          error: reject
        });
      });
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Upload failed';
    } finally {
      this.uploadProgress = null;
    }
  }

  downloadSelected(): void {
    this.entries
      .filter((entry) => this.selected.has(entry.key) && !entry.directory)
      .forEach((entry) => {
        const a = document.createElement('a');
        a.href = this.api.s3DownloadUrl(this.environmentId, this.bucket, entry.key);
        a.download = entry.name;
        a.click();
      });
  }

  private emitLocation(): void {
    const bucketLabel = this.bucket || '$S3_BUCKET';
    this.locationChange.emit(`${bucketLabel}:/${this.prefix}`);
  }
}
