import { z } from "zod";

export const reportSchema = z.strictObject({ id: z.string(), title: z.string().min(1) });
export type Report = z.infer<typeof reportSchema>;

export function reportLabel(report: Report): string {
  return `${report.id}: ${report.title}`;
}