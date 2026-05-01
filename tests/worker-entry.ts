// Minimal worker entry for vitest-pool-workers.
// Exports the DurableObject classes so runInDurableObject() can access them.
// Does NOT import @tanstack/react-start/server-entry to avoid SSR plugin issues.
export { PresenceDO } from "../src/server/presence-do";

export default {
  fetch() {
    return new Response("test-worker");
  },
};
