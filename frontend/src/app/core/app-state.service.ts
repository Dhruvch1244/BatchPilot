import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AppSettings, ConnectionStatus, Environment, EnvironmentRequest } from './models';

const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  theme: 'dark',
  autoReconnect: true,
  reconnectIntervalSeconds: 5,
  maxReconnectAttempts: 5,
  maxTabs: 10,
  maxUploadSizeMb: 512
};

/**
 * Single source of truth for environments, live connection statuses, and
 * settings — the Angular equivalent of the app's React Context. Backed by
 * signals so templates re-render automatically on change, with no manual
 * subscription management needed in components.
 */
@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly _environments = signal<Environment[]>([]);
  private readonly _statuses = signal<Record<string, ConnectionStatus>>({});
  private readonly _settings = signal<AppSettings>(DEFAULT_SETTINGS);
  private readonly _selectedEnvironmentId = signal<string | null>(null);
  private readonly _loading = signal(true);
  private readonly _error = signal<string | null>(null);

  readonly environments = this._environments.asReadonly();
  readonly statuses = this._statuses.asReadonly();
  readonly settings = this._settings.asReadonly();
  readonly selectedEnvironmentId = this._selectedEnvironmentId.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly selectedEnvironment = computed(
    () => this._environments().find((e) => e.id === this._selectedEnvironmentId()) ?? null
  );
  readonly selectedStatus = computed(() => {
    const id = this._selectedEnvironmentId();
    return id ? this._statuses()[id] : undefined;
  });

  constructor(private api: ApiService) {}

  async init(): Promise<void> {
    try {
      const [envs, settings] = await Promise.all([
        firstValueFrom(this.api.listEnvironments()),
        firstValueFrom(this.api.getSettings())
      ]);
      this._environments.set(envs);
      this._settings.set(settings);
      await Promise.all(envs.map((e) => this.refreshStatus(e.id)));
    } catch (e) {
      this._error.set(this.errorMessage(e, 'Failed to load application state'));
    } finally {
      this._loading.set(false);
    }

    setInterval(() => {
      Object.entries(this._statuses()).forEach(([id, status]) => {
        if (status.state === 'CONNECTED' || status.state === 'RECONNECTING' || status.state === 'CONNECTING') {
          this.refreshStatus(id);
        }
      });
    }, 5000);
  }

  selectEnvironment(id: string | null): void {
    this._selectedEnvironmentId.set(id);
  }

  clearError(): void {
    this._error.set(null);
  }

  async refreshEnvironments(): Promise<Environment[]> {
    const list = await firstValueFrom(this.api.listEnvironments());
    this._environments.set(list);
    return list;
  }

  async refreshStatus(id: string): Promise<void> {
    try {
      const status = await firstValueFrom(this.api.connectionStatus(id));
      this._statuses.update((prev) => ({ ...prev, [id]: status }));
    } catch {
      // environment may have just been deleted; ignore transient failures
    }
  }

  async createEnvironment(request: EnvironmentRequest): Promise<Environment> {
    return this.runOrThrow(async () => {
      const created = await firstValueFrom(this.api.createEnvironment(request));
      await this.refreshEnvironments();
      return created;
    });
  }

  async updateEnvironment(id: string, request: EnvironmentRequest): Promise<Environment> {
    return this.runOrThrow(async () => {
      const updated = await firstValueFrom(this.api.updateEnvironment(id, request));
      await this.refreshEnvironments();
      return updated;
    });
  }

  async deleteEnvironment(id: string): Promise<void> {
    return this.runOrThrow(async () => {
      await firstValueFrom(this.api.deleteEnvironment(id));
      await this.refreshEnvironments();
      this._statuses.update((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (this._selectedEnvironmentId() === id) {
        this._selectedEnvironmentId.set(null);
      }
    });
  }

  async duplicateEnvironment(id: string): Promise<Environment> {
    return this.runOrThrow(async () => {
      const copy = await firstValueFrom(this.api.duplicateEnvironment(id));
      await this.refreshEnvironments();
      return copy;
    });
  }

  async connect(id: string): Promise<void> {
    return this.runOrThrow(async () => {
      this._statuses.update((prev) => ({ ...prev, [id]: { ...prev[id], environmentId: id, state: 'CONNECTING' } }));
      const status = await firstValueFrom(this.api.connect(id));
      this._statuses.update((prev) => ({ ...prev, [id]: status }));
    });
  }

  async disconnect(id: string): Promise<void> {
    return this.runOrThrow(async () => {
      const status = await firstValueFrom(this.api.disconnect(id));
      this._statuses.update((prev) => ({ ...prev, [id]: status }));
    });
  }

  async reconnect(id: string): Promise<void> {
    return this.runOrThrow(async () => {
      this._statuses.update((prev) => ({ ...prev, [id]: { ...prev[id], environmentId: id, state: 'RECONNECTING' } }));
      const status = await firstValueFrom(this.api.reconnect(id));
      this._statuses.update((prev) => ({ ...prev, [id]: status }));
    });
  }

  async updateSettings(settings: AppSettings): Promise<void> {
    return this.runOrThrow(async () => {
      const saved = await firstValueFrom(this.api.updateSettings(settings));
      this._settings.set(saved);
    });
  }

  private async runOrThrow<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      this._error.set(this.errorMessage(e, 'Unexpected error'));
      throw e;
    }
  }

  private errorMessage(e: unknown, fallback: string): string {
    if (e && typeof e === 'object' && 'error' in e) {
      const body = (e as { error?: { message?: string } }).error;
      if (body?.message) return body.message;
    }
    if (e instanceof Error) return e.message;
    return fallback;
  }
}
