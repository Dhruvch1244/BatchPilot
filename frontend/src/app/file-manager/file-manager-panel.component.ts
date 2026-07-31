import { DatePipe } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { FileEntry } from '../core/models';
import { IconComponent } from '../shared/icon.component';

type ViewMode = 'table' | 'grid';

function formatSize(bytes: number): string {
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
  selector: 'app-file-manager-panel',
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
        <button class="btn" type="button" [disabled]="path === '.' || path === '/'" (click)="navigateUp()">
          <app-icon name="chevron-up" size="14" /> Up
        </button>
        <input class="file-manager-path" [(ngModel)]="path" (keydown.enter)="load()" />
        <span class="input-with-icon">
          <app-icon name="search" size="13" />
          <input
            class="file-manager-search"
            placeholder="Search this folder and subfolders…"
            [(ngModel)]="search"
            (ngModelChange)="load()"
          />
        </span>
        <button class="btn" type="button" (click)="fileInput.click()">Upload</button>
        <input #fileInput type="file" multiple hidden (change)="onFileInputChange($event)" />
        <button class="btn" type="button" [disabled]="selected.size === 0" (click)="downloadSelected()">
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

      @if (isSearching()) {
        <div class="file-manager-search-hint">
          <app-icon name="search" size="12" />
          Searching "{{ search }}" in this folder and all subfolders — click a result to jump to where it is.
        </div>
      }

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
                  <th>Name</th>
                  <th>Size</th>
                  <th>Modified</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody>
                @for (entry of entries; track entry.path) {
                  <tr
                    [class.row-selected]="selected.has(entry.path)"
                    (click)="isSearching() && goToLocation(entry)"
                    (dblclick)="!isSearching() && navigateInto(entry)"
                  >
                    <td>
                      <input
                        type="checkbox"
                        [checked]="selected.has(entry.path)"
                        (click)="$event.stopPropagation()"
                        (change)="toggleSelect(entry.path)"
                      />
                    </td>
                    <td class="file-name-cell">
                      <app-icon [name]="entry.directory ? 'folder' : 'file'" size="15" />
                      <span>
                        {{ entry.name }}
                        @if (isSearching()) {
                          <span class="file-location-hint">{{ locationOf(entry) }}</span>
                        }
                      </span>
                    </td>
                    <td>{{ entry.directory ? '—' : formatSize(entry.size) }}</td>
                    <td>{{ entry.lastModified ? (entry.lastModified | date: 'medium') : '—' }}</td>
                    <td>{{ entry.permissions }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <div class="file-grid">
              @for (entry of entries; track entry.path) {
                <div
                  class="file-grid-item"
                  [class.row-selected]="selected.has(entry.path)"
                  (click)="isSearching() ? goToLocation(entry) : toggleSelect(entry.path)"
                  (dblclick)="!isSearching() && navigateInto(entry)"
                >
                  <div class="file-grid-icon"><app-icon [name]="entry.directory ? 'folder' : 'file'" size="28" /></div>
                  <div class="file-grid-name">{{ entry.name }}</div>
                  @if (isSearching()) {
                    <div class="file-location-hint">{{ locationOf(entry) }}</div>
                  } @else if (!entry.directory) {
                    <div class="file-grid-size">{{ formatSize(entry.size) }}</div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      @if (dragOver) {
        <div class="drop-overlay">Drop files to upload to {{ path }}</div>
      }
    </div>
  `
})
export class FileManagerPanelComponent implements OnInit {
  @Input({ required: true }) environmentId!: string;
  /** Lets the owning tab keep its title in sync with whatever folder this instance is
   * currently browsing - useful now that more than one Files tab can be open at once
   * for the same environment. */
  @Output() pathChange = new EventEmitter<string>();
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  path = '.';
  entries: FileEntry[] = [];
  loading = false;
  error: string | null = null;
  search = '';
  view: ViewMode = 'table';
  selected = new Set<string>();
  dragOver = false;
  uploadProgress: { loaded: number; total: number } | null = null;

  readonly formatSize = formatSize;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.entries = await firstValueFrom(this.api.listFiles(this.environmentId, this.path, this.search || undefined));
      this.pathChange.emit(this.path);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to list directory';
    } finally {
      this.loading = false;
      this.selected = new Set();
    }
  }

  navigateInto(entry: FileEntry): void {
    if (entry.directory) {
      this.path = entry.path;
      this.load();
    }
  }

  isSearching(): boolean {
    return this.search.trim().length > 0;
  }

  /** Deep-search results carry their full path (e.g. "sub/subsub/file.txt"); shown
   * next to the name so it's clear where a match actually lives. */
  locationOf(entry: FileEntry): string {
    const idx = entry.path.lastIndexOf('/');
    return idx > 0 ? entry.path.slice(0, idx) : '.';
  }

  goToLocation(entry: FileEntry): void {
    this.path = entry.directory ? entry.path : this.locationOf(entry);
    this.search = '';
    this.load();
  }

  navigateUp(): void {
    if (this.path === '.' || this.path === '/') return;
    const trimmed = this.path.replace(/\/+$/, '');
    const parent = trimmed.substring(0, trimmed.lastIndexOf('/'));
    this.path = parent === '' ? '/' : parent;
    this.load();
  }

  toggleSelect(path: string): void {
    const next = new Set(this.selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
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
        this.api.uploadFiles(this.environmentId, this.path, files).subscribe({
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
      .filter((entry) => this.selected.has(entry.path) && !entry.directory)
      .forEach((entry) => {
        const a = document.createElement('a');
        a.href = this.api.downloadUrl(this.environmentId, entry.path);
        a.download = entry.name;
        a.click();
      });
  }
}
