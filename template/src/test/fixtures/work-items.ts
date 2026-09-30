import type { WorkItem } from "@features/work-items/model";

export const initialWorkItems: WorkItem[] = [
  { id: "wi-1", title: "Review model application", status: "in-progress" },
  { id: "wi-2", title: "Verify visual baselines", status: "open" },
  { id: "wi-3", title: "Publish release notes", status: "done" },
];