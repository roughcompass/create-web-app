import { z } from "zod";

export const workItemStatusSchema = z.enum(["open", "in-progress", "done"]);
export const workItemSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().trim().min(3).max(100),
  status: workItemStatusSchema,
});
export const workItemListSchema = z.array(workItemSchema);

export type WorkItem = z.infer<typeof workItemSchema>;
export type WorkItemStatus = z.infer<typeof workItemStatusSchema>;