export type Environment = 'production' | 'sandbox';
export type Properties = Readonly<Record<string, string | number | boolean | null>>;
export interface EventOptions { id?: string; occurred_at?: string; environment?: Environment; historical?: boolean; }
export interface MakerPingEvent {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly occurred_at: string;
  readonly environment: Environment;
  /** Server-only backfill, with a separate budget and no alerts or trial activation. */
  readonly historical?: boolean;
  readonly properties: Properties;
}
/** Accepted IDs identify server journal receipts; rejected IDs identify the submitted occurrence. */
export type Receipt =
  | {accepted: true; id: string; duplicate: boolean; attempts: number; status: number}
  | {accepted: false; reason: string; code?: string; id?: string; attempts?: number; status?: number; retryAfterMs?: number};
export interface TransportOptions {
  endpoint?: string;
  environment?: Environment;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
  maxPending?: number;
  fetch?: typeof globalThis.fetch;
}
export interface Client {
  track(name: string, properties?: Properties, options?: EventOptions): Promise<Receipt>;
  send(event: MakerPingEvent): Promise<Receipt>;
  flush(): Promise<void>;
}
export declare function prepareEvent(name: string, properties?: Properties, options?: EventOptions): MakerPingEvent;
