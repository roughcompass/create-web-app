import { setupServer } from "msw/node";
import { handlers, resetWorkItems } from "./handlers";

export const server = setupServer(...handlers);

export function resetTestData(): void {
  resetWorkItems();
  server.resetHandlers();
}