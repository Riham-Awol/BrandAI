import "server-only";
import { getTextProvider } from "./providers/registry.js";

/** Whether text generation can run on this server (for UI messaging only). */
export function getAiStatus() {
  try {
    const provider = getTextProvider();
    return { configured: provider.configured === true, isMock: provider.isMock === true };
  } catch {
    return { configured: false, isMock: false };
  }
}
