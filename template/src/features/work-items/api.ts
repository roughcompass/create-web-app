import { requestJson } from "@shared/api";
import { workItemListSchema, workItemSchema, type WorkItem, type WorkItemStatus } from "./model";

const endpoint = "/api/work-items";

export function listWorkItems(signal?: AbortSignal): Promise<WorkItem[]> {
  return requestJson(workItemListSchema, endpoint, { ...(signal === undefined ? {} : { signal }) });
}

export function createWorkItem(input: { title: string }): Promise<WorkItem> {
  return requestJson(workItemSchema, endpoint, {
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  });
}

export function updateWorkItem(input: { id: string; title: string; status: WorkItemStatus }): Promise<WorkItem> {
  return requestJson(workItemSchema, `${endpoint}/${encodeURIComponent(input.id)}`, {
    init: {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: input.title, status: input.status }),
    },
  });
}