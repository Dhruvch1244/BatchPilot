import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Now that S3 Transfer (and, in principle, Quick Execute) can have more than one tab
 * open at once, a command run in one tab shouldn't leave a sibling tab's "Past
 * commands"/"Past uploads" list stale until it happens to reload on its own. Each
 * panel instance calls `notifyChanged()` after recording a run and subscribes to
 * `changes` to reload its own list - a plain in-memory pub/sub is enough since every
 * open tab lives in the same page.
 */
@Injectable({ providedIn: 'root' })
export class CommandHistoryBusService {
  private readonly changed$ = new Subject<void>();
  readonly changes = this.changed$.asObservable();

  notifyChanged(): void {
    this.changed$.next();
  }
}
