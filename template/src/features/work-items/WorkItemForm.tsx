import { useState, type FormEvent } from "react";
import type { WorkItemStatus } from "./model";

export interface WorkItemFormProps {
  initialTitle?: string;
  initialStatus?: WorkItemStatus;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: { title: string; status: WorkItemStatus }) => Promise<void>;
}

export function WorkItemForm({ initialTitle = "", initialStatus = "open", submitLabel, pending, onSubmit }: WorkItemFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<WorkItemStatus>(initialStatus);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = title.trim();
    if (normalized.length < 3) {
      setError("Title must contain at least three characters.");
      return;
    }
    setError("");
    await onSubmit({ title: normalized, status });
    if (initialTitle === "") setTitle("");
  };

  return (
    <form onSubmit={(event) => { void submit(event); }}>
      <label htmlFor={`${submitLabel}-title`}>Title</label>
      <input id={`${submitLabel}-title`} value={title} onChange={(event) => { setTitle(event.currentTarget.value); }} aria-describedby={error === "" ? undefined : `${submitLabel}-error`} />
      {initialTitle !== "" && (
        <>
          <label htmlFor={`${submitLabel}-status`}>Status</label>
          <select id={`${submitLabel}-status`} value={status} onChange={(event) => { setStatus(event.currentTarget.value as WorkItemStatus); }}>
            <option value="open">Open</option>
            <option value="in-progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </>
      )}
      {error !== "" && <p id={`${submitLabel}-error`} role="alert">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}