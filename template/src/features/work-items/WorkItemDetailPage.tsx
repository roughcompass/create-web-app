import { Link, useParams } from "react-router";
import { normalizeError } from "@shared/api";
import { WorkItemForm } from "./WorkItemForm";
import { useUpdateWorkItem, useWorkItems } from "./queries";

export function WorkItemDetailPage() {
  const { workItemId = "" } = useParams();
  const workItems = useWorkItems();
  const update = useUpdateWorkItem();
  if (workItems.isPending) return <p role="status">Loading work item…</p>;
  if (workItems.isError) return <p role="alert">{normalizeError(workItems.error).message}</p>;
  const workItem = workItems.data.find((item) => item.id === workItemId);
  if (workItem === undefined) {
    return <section><h1>Work item not found</h1><Link to="/work-items">Return to work items</Link></section>;
  }
  return (
    <section>
      <h1>{workItem.title}</h1>
      <WorkItemForm
        initialTitle={workItem.title}
        initialStatus={workItem.status}
        submitLabel="Save"
        pending={update.isPending}
        onSubmit={async (input) => { await update.mutateAsync({ id: workItem.id, ...input }); }}
      />
      {update.isError && <p role="alert">{normalizeError(update.error).message}</p>}
      {update.isSuccess && <p role="status">Work item saved.</p>}
    </section>
  );
}