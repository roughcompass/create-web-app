import "@salt-ds/theme/index.css";
import "./styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "@app/index";

const root = document.querySelector<HTMLElement>("#root");
if (root === null) throw new Error("Application root #root is missing");

if (import.meta.env.DEV) {
  const { worker } = await import("@test/browser");
  await worker.start({ onUnhandledFrame: "error", quiet: true });
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);