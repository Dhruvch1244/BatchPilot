import { HttpClient, HttpEvent, HttpEventType, HttpParams, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AppSettings,
  ConnectionStatus,
  Environment,
  EnvironmentRequest,
  FileEntry,
  QuickExecuteResult
} from './models';

export interface UploadProgress {
  loaded: number;
  total: number;
  done: boolean;
  response?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // ---------- Environments ----------
  listEnvironments(): Observable<Environment[]> {
    return this.http.get<Environment[]>('/api/environments');
  }

  getEnvironment(id: string): Observable<Environment> {
    return this.http.get<Environment>(`/api/environments/${id}`);
  }

  createEnvironment(body: EnvironmentRequest): Observable<Environment> {
    return this.http.post<Environment>('/api/environments', body);
  }

  updateEnvironment(id: string, body: EnvironmentRequest): Observable<Environment> {
    return this.http.put<Environment>(`/api/environments/${id}`, body);
  }

  duplicateEnvironment(id: string): Observable<Environment> {
    return this.http.post<Environment>(`/api/environments/${id}/duplicate`, {});
  }

  deleteEnvironment(id: string): Observable<void> {
    return this.http.delete<void>(`/api/environments/${id}`);
  }

  // ---------- Connection ----------
  connect(id: string): Observable<ConnectionStatus> {
    return this.http.post<ConnectionStatus>(`/api/environments/${id}/connection/connect`, {});
  }

  disconnect(id: string): Observable<ConnectionStatus> {
    return this.http.post<ConnectionStatus>(`/api/environments/${id}/connection/disconnect`, {});
  }

  reconnect(id: string): Observable<ConnectionStatus> {
    return this.http.post<ConnectionStatus>(`/api/environments/${id}/connection/reconnect`, {});
  }

  connectionStatus(id: string): Observable<ConnectionStatus> {
    return this.http.get<ConnectionStatus>(`/api/environments/${id}/connection/status`);
  }

  // ---------- Quick Execute ----------
  runQuickExecute(environmentId: string, command: string, timeoutSeconds?: number): Observable<QuickExecuteResult> {
    return this.http.post<QuickExecuteResult>('/api/quick-execute', { environmentId, command, timeoutSeconds });
  }

  // ---------- File Manager ----------
  listFiles(environmentId: string, path: string, search?: string): Observable<FileEntry[]> {
    let params = new HttpParams().set('path', path);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<FileEntry[]>(`/api/environments/${environmentId}/files`, { params });
  }

  downloadUrl(environmentId: string, path: string): string {
    const params = new HttpParams().set('path', path);
    return `/api/environments/${environmentId}/files/download?${params.toString()}`;
  }

  /** Emits UploadProgress events as the transfer proceeds, ending with `done: true` and the server response. */
  uploadFiles(environmentId: string, path: string, files: File[]): Observable<UploadProgress> {
    const form = new FormData();
    form.append('path', path);
    files.forEach((file) => form.append('files', file));

    const request = new HttpRequest('POST', `/api/environments/${environmentId}/files/upload`, form, {
      reportProgress: true
    });

    return new Observable<UploadProgress>((subscriber) => {
      const sub = this.http.request<Record<string, string>>(request).subscribe({
        next: (event: HttpEvent<Record<string, string>>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            subscriber.next({ loaded: event.loaded, total: event.total, done: false });
          } else if (event.type === HttpEventType.Response) {
            subscriber.next({ loaded: 1, total: 1, done: true, response: event.body ?? undefined });
            subscriber.complete();
          }
        },
        error: (err) => subscriber.error(err)
      });
      return () => sub.unsubscribe();
    });
  }

  // ---------- Settings ----------
  getSettings(): Observable<AppSettings> {
    return this.http.get<AppSettings>('/api/settings');
  }

  updateSettings(settings: AppSettings): Observable<AppSettings> {
    return this.http.put<AppSettings>('/api/settings', settings);
  }
}
