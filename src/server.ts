import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

// #region quickstart:if=do
// Re-export DurableObject classes so wrangler can register them.
// This is the TanStack Start documented pattern for DOs/queues/scheduled events.
export { PresenceDO } from "./server/presence-do";
// #endregion

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
