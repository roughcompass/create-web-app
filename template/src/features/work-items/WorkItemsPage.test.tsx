import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { server } from "@test/server";
import { WorkItemDetailPage } from "./WorkItemDetailPage";
import { WorkItemsPage } from "./WorkItemsPage";

describe("WorkItemsPage", () => {
  it("loads, displays, and filters work items", async () => {
    renderPage();
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(await screen.findByRole("link", { name: "Review model application" })).not.toBeNull();
    await userEvent.type(screen.getByRole("textbox", { name: "Filter work items" }), "visual");
    expect(screen.queryByRole("link", { name: "Review model application" })).toBeNull();
    expect(screen.getByRole("link", { name: "Verify visual baselines" })).not.toBeNull();
  });

  it("shows empty, unavailable, malformed, and recovery states", async () => {
    server.use(http.get("/api/work-items", () => HttpResponse.json([])));
    const empty = renderPage();
    expect(await screen.findByText("No work items match this view.")).not.toBeNull();
    empty.unmount();

    let attempts = 0;
    server.use(http.get("/api/work-items", () => {
      attempts += 1;
      return attempts === 1 ? HttpResponse.error() : HttpResponse.json([]);
    }));
    const unavailable = renderPage();
    expect(await screen.findByRole("heading", { name: "Work items unavailable" })).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No work items match this view.")).not.toBeNull();
    unavailable.unmount();

    server.use(http.get("/api/work-items", () => HttpResponse.json([{ id: 1 }])));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Work items unavailable" })).not.toBeNull();
  });

  it("validates and creates a work item", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Review model application" });
    const title = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "x" } });
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByRole("alert").textContent).toContain("at least three");
    await userEvent.clear(title);
    await userEvent.type(title, "Document release evidence");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("link", { name: "Document release evidence" })).not.toBeNull();
    await waitFor(() => { expect(screen.getByRole("status").textContent).toContain("created"); });
  });

  it("loads and edits a work-item detail route", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/work-items/wi-1"]}>
          <Routes><Route path="/work-items/:workItemId" element={<WorkItemDetailPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Review model application" })).not.toBeNull();
    const title = screen.getByRole("textbox", { name: "Title" });
    await userEvent.clear(title);
    await userEvent.type(title, "Review approved model");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "done");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => { expect(screen.getByRole("status").textContent).toContain("saved"); });
  });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><WorkItemsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}