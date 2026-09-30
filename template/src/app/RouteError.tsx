import { isRouteErrorResponse, Link, useRouteError } from "react-router";

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${String(error.status)} ${error.statusText}`
    : error instanceof Error ? error.message : "The page could not be loaded.";
  return (
    <main>
      <h1>Something went wrong</h1>
      <p role="alert">{message}</p>
      <Link to="/">Return home</Link>
    </main>
  );
}