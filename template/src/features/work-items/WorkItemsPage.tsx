import { useState } from "react";
import { Link } from "react-router";
import { normalizeError } from "@shared/api";
import { WorkItemForm } from "./WorkItemForm";
import { useCreateWorkItem, useWorkItems } from "./queries";

export function WorkItemsPage() {
  const [filter, setFilter] = useState("");
  const workItems = useWorkItems();
  const create = useCreateWorkItem();
  if (workItems.isPending) return <p role="status">Loading work items…</p>;
  if (workItems.isError) {
    return (
      <section>
        <h1>Work items unavailable</h1>
        <p role="alert">{normalizeError(workItems.error).message}</p>
        <button type="button" onClick={() => { void workItems.refetch(); }}>Try again</button>
      </section>
    );
  }
  const visible = workItems.data.filter((item) => item.title.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  return (
    <section>
      <h1>Work items</h1>
      <label htmlFor="work-item-filter">Filter work items</label>
      <input id="work-item-filter" value={filter} onChange={(event) => { setFilter(event.currentTarget.value); }} />
      {visible.length === 0 ? <p role="status">No work items match this view.</p> : (
        <ul>
          {visible.map((item) => <li key={item.id}><Link to={`/work-items/${item.id}`}>{item.title}</Link> — {item.status}</li>)}
        </ul>
      )}
      <h2>Create work item</h2>
      <WorkItemForm
        submitLabel="Create"
        pending={create.isPending}
        onSubmit={async ({ title }) => { await create.mutateAsync({ title }); }}
      />
      {create.isError && <p role="alert">{normalizeError(create.error).message}</p>}
      {create.isSuccess && <p role="status">Work item created.</p>}
    </section>
  );
}