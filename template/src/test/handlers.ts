import { http, HttpResponse } from "msw";
import { initialWorkItems } from "./fixtures/work-items";

let workItems = structuredClone(initialWorkItems);

export const handlers = [
  http.get("/api/work-items", () => HttpResponse.json(workItems)),
  http.post("/api/work-items", async ({ request }) => {
    const input = await request.json() as { title?: unknown };
    if (typeof input.title !== "string") return HttpResponse.json({ message: "Title is required" }, { status: 400 });
    const item = { id: `wi-${String(workItems.length + 1)}`, title: input.title, status: "open" as const };
    workItems.push(item);
    return HttpResponse.json(item, { status: 201 });
  }),
  http.put("/api/work-items/:id", async ({ params, request }) => {
    const input = await request.json() as { title?: unknown; status?: unknown };
    const index = workItems.findIndex((item) => item.id === params.id);
    if (index < 0) return HttpResponse.json({ message: "Not found" }, { status: 404 });
    const current = workItems[index];
    if (current === undefined || typeof input.title !== "string" || !["open", "in-progress", "done"].includes(String(input.status))) {
      return HttpResponse.json({ message: "Invalid input" }, { status: 400 });
    }
    const updated = { ...current, title: input.title, status: input.status as typeof current.status };
    workItems[index] = updated;
    return HttpResponse.json(updated);
  }),
];

export function resetWorkItems(): void {
  workItems = structuredClone(initialWorkItems);
}