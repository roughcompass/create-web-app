import { reportLabel, reportSchema } from "@features/reports";

export function parseReport(input: unknown): string {
  return reportLabel(reportSchema.parse(input));
}