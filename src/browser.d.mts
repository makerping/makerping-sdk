import type {Client, TransportOptions} from './types.mjs';
export type {Client, Environment, EventOptions, MakerPingEvent, Properties, Receipt, TransportOptions} from './types.mjs';
export {prepareEvent} from './types.mjs';
export interface BrowserOptions extends TransportOptions { collector: string; token?: never; }
export interface BrowserClient extends Client { init(): Promise<boolean>; consent(value: boolean): void; }
export declare function createMakerPing(options: BrowserOptions): BrowserClient;
