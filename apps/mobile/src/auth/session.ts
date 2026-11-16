/** A monotonically increasing request generation. Only the latest request may commit. */
export class RequestGeneration {
  private current = 0;

  begin(): number {
    this.current += 1;
    return this.current;
  }

  invalidate(): void {
    this.current += 1;
  }

  isCurrent(generation: number): boolean {
    return generation === this.current;
  }
}

/** An initial getSession snapshot is stale after any authoritative auth event. */
export class AuthEventGeneration {
  private current = 0;

  snapshot(): number {
    return this.current;
  }

  noteEvent(): void {
    this.current += 1;
  }

  isCurrent(snapshot: number): boolean {
    return snapshot === this.current;
  }
}
