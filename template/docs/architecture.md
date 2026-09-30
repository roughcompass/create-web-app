# Application Architecture

The generated application is a replaceable vertical example, not a product domain. Keep ownership visible through four layers:

```text
src/app/       composition, providers, router, shell, route/error boundaries
src/features/  domain-owned vertical features with public index files
src/shared/    product-neutral API, configuration, UI composition, and utilities
src/test/      MSW, render helpers, and deterministic fixtures
```

## Add a Feature

Use `src/features/work-items` as the complete reference.

1. Create `src/features/<feature>/index.ts` as the only public import path.
2. Put runtime schemas and domain types in `model.ts`.
3. Put network calls behind `api.ts`; validate every response before returning it.
4. Put query keys and mutations in `queries.ts` so cache behavior has one owner.
5. Keep route components and forms inside the feature.
6. Export only route-level components and intentionally shared domain types from the public index.
7. Register routes in `src/app/router.tsx` through `@features/<feature>`.
8. Add user-visible tests beside the feature and deterministic request handlers under `src/test`.

Run the architecture checker after changing imports:

```sh
npm run lint:boundaries
```

Features may depend on public `@shared/<area>` modules. They must not import another feature's internal files or app composition. Shared modules must not import features or app modules. Root/bootstrap and app modules compose public feature and shared exports.

## State and Data

TanStack Query owns remote data, caching, mutations, retries, and invalidation. Keep transient UI state close to the component that owns the interaction. Introduce context only when several distant descendants need the same local concern. Do not copy query results into local state.

Treat environment variables and service responses as unknown input. Add or extend Zod schemas at `shared/config` or the owning feature boundary. Convert network, HTTP, malformed-response, cancellation, configuration, and unexpected failures into the normalized application error contract before rendering.

MSW handlers exercise the same URLs and schemas as the application. Add success, empty, malformed, delayed, and failure responses before adding UI branches for them. Unhandled requests fail tests.

## Errors and Recovery

Use route error elements for navigation/data-loader failures and the application error boundary for unexpected render failures. A feature with recoverable remote failure must expose a visible retry. Error text must be useful without revealing payloads, URLs containing credentials, or stack traces.

## Aliases and Public Imports

- `@app/*` owns application composition.
- `@features/<name>` addresses only a feature public index.
- `@shared/<area>` addresses only a shared-area public index.
- `@test/*` is test-only support.

Do not add alias patterns that expose arbitrary internals. Relative imports stay inside their current layer/area.

## Deployment

The production build is static. Follow [SPA deployment](deployment.md) and verify direct navigation to every new route. A new feature is not complete until typecheck, architecture checks, user-visible tests, production build, and the applicable story/visual checks pass.

Validate the guide's miniature feature:

```sh
npm run verify:feature-guide
```