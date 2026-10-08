import {createMakerPing} from '@makerping/sdk/browser';

export function connectActions(publicCollector) {
  const ping = createMakerPing({collector: publicCollector, environment: 'sandbox'});
  return {
    // Connect this to an actual consent decision when your source requires it.
    setConsent: value => ping.consent(value),
    // Call only after your application's export action has succeeded.
    exportCompleted: () => ping.track('export_completed', {format: 'pdf'}),
  };
}
