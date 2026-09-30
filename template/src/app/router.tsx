import { createBrowserRouter } from "react-router";
import { WorkItemDetailPage, WorkItemsPage } from "@features/work-items";
import { App } from "./App";
import { RouteError } from "./RouteError";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
    ErrorBoundary: RouteError,
    children: [
      {
        index: true,
        element: (
          <section>
            <h1>Build with a clear path</h1>
            <p>This model application turns design and code standards into executable checks.</p>
          </section>
        ),
      },
      {
        path: "work-items",
        element: <WorkItemsPage />,
      },
      {
        path: "work-items/:workItemId",
        element: <WorkItemDetailPage />,
      },
    ],
  },
]);