import type {Client, TransportOptions} from './types.mjs';
export type {Client, Environment, EventOptions, MakerPingEvent, Properties, Receipt, TransportOptions} from './types.mjs';
export {prepareEvent} from './types.mjs';
export interface ServerOptions extends TransportOptions { token: string; }
export declare function createMakerPing(options: ServerOptions): Client;
