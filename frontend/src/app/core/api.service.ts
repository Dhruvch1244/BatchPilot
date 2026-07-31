import { HttpClient, HttpEvent, HttpEventType, HttpParams, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AppSettings,
  CommandHistoryEntry,
  CommandHistorySource,
  ConnectionStatus,
  Environment,
  EnvironmentRequest,
  FileEntry,
  QuickExecuteResult,
  S3CopyRequest,
  StageSearchHistoryEntry,
  StageSearchResult,
  YarnActionResponse,
  YarnApplication,
  YarnNode
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

  // ---------- YARN applications ----------
  listYarnApplications(environmentId: string): Observable<YarnApplication[]> {
    return this.http.get<YarnApplication[]>(`/api/environments/${environmentId}/yarn/applications`);
  }

  killYarnApplication(environmentId: string, applicationId: string): Observable<YarnActionResponse> {
    return this.http.post<YarnActionResponse>(
      `/api/environments/${environmentId}/yarn/applications/${applicationId}/kill`,
      {}
    );
  }

  getYarnLogs(environmentId: string, applicationId: string, lines?: number): Observable<{ logs: string }> {
    let params = new HttpParams();
    if (lines) params = params.set('lines', lines);
    return this.http.get<{ logs: string }>(
      `/api/environments/${environmentId}/yarn/applications/${applicationId}/logs`,
      { params }
    );
  }

  yarnLogsDownloadUrl(environmentId: string, applicationId: string, sizeLimitMb: number, grep?: string, caseInsensitive = true): string {
    let params = new HttpParams().set('sizeLimitMb', sizeLimitMb).set('caseInsensitive', caseInsensitive);
    if (grep) params = params.set('grep', grep);
    return `/api/environments/${environmentId}/yarn/applications/${applicationId}/logs/download?${params.toString()}`;
  }

  listYarnNodes(environmentId: string): Observable<YarnNode[]> {
    return this.http.get<YarnNode[]>(`/api/environments/${environmentId}/yarn/nodes`);
  }

  yarnQueueStatus(environmentId: string, queueName: string): Observable<{ output: string }> {
    return this.http.get<{ output: string }>(`/api/environments/${environmentId}/yarn/queues/${queueName}`);
  }

  yarnApplicationAttempts(environmentId: string, applicationId: string): Observable<{ output: string }> {
    return this.http.get<{ output: string }>(`/api/environments/${environmentId}/yarn/applications/${applicationId}/attempts`);
  }

  yarnContainers(environmentId: string, attemptId: string): Observable<{ output: string }> {
    return this.http.get<{ output: string }>(`/api/environments/${environmentId}/yarn/attempts/${attemptId}/containers`);
  }

  // ---------- S3 vendor-staging transfer ----------
  listVendors(): Observable<string[]> {
    return this.http.get<string[]>('/api/vendors');
  }

  addVendor(name: string): Observable<string[]> {
    return this.http.post<string[]>('/api/vendors', { name });
  }

  removeVendor(name: string): Observable<string[]> {
    return this.http.delete<string[]>(`/api/vendors/${encodeURIComponent(name)}`);
  }

  runS3Transfer(environmentId: string, request: S3CopyRequest): Observable<QuickExecuteResult> {
    return this.http.post<QuickExecuteResult>(`/api/environments/${environmentId}/s3-transfer`, request);
  }

  // ---------- File stage tracker ----------
  searchStages(environmentId: string, query: string): Observable<StageSearchResult> {
    const params = new HttpParams().set('query', query);
    return this.http.get<StageSearchResult>(`/api/environments/${environmentId}/stage-tracker/search`, { params });
  }

  stageSearchHistory(): Observable<StageSearchHistoryEntry[]> {
    return this.http.get<StageSearchHistoryEntry[]>('/api/stage-tracker/history');
  }

  clearStageSearchHistory(): Observable<void> {
    return this.http.delete<void>('/api/stage-tracker/history');
  }

  // ---------- Command history (Quick Execute + S3 Transfer) ----------
  commandHistory(source?: CommandHistorySource, limit = 20): Observable<CommandHistoryEntry[]> {
    let params = new HttpParams().set('limit', limit);
    if (source) params = params.set('source', source);
    return this.http.get<CommandHistoryEntry[]>('/api/command-history', { params });
  }

  clearCommandHistory(source?: CommandHistorySource): Observable<void> {
    let params = new HttpParams();
    if (source) params = params.set('source', source);
    return this.http.delete<void>('/api/command-history', { params });
  }

  // ---------- Settings ----------
  getSettings(): Observable<AppSettings> {
    return this.http.get<AppSettings>('/api/settings');
  }

  updateSettings(settings: AppSettings): Observable<AppSettings> {
    return this.http.put<AppSettings>('/api/settings', settings);
  }
}
