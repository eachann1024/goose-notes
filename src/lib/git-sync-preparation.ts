export interface GitSyncPreparationRequest {
  finished: boolean;
  addRelease: (release: () => void) => void;
}

/** Tracks all roots in one window request; late acquisitions are released immediately. */
export class GitSyncPreparation {
  private requests = new Map<string, { request: GitSyncPreparationRequest; release: () => void }>();
  private finished = new Set<string>();

  finish(id: string) {
    this.finished.add(id);
    this.requests.get(id)?.release();
    this.requests.delete(id);
    // Request IDs are UUIDs; retain a bounded set to ignore delayed duplicate messages.
    if (this.finished.size > 1000) this.finished.delete(this.finished.values().next().value!);
  }

  async prepare(id: string, operation: (request: GitSyncPreparationRequest) => Promise<void>): Promise<boolean> {
    if (this.finished.has(id) || this.requests.has(id)) return false;
    const releases: (() => void)[] = [];
    const request: GitSyncPreparationRequest = {
      finished: false,
      addRelease: (release) => { if (request.finished) release(); else releases.push(release); },
    };
    this.requests.set(id, { request, release: () => { request.finished = true; releases.splice(0).reverse().forEach((release) => release()); } });
    try { await operation(request); return !request.finished; }
    catch (error) { this.finish(id); throw error; }
  }
}
