# SPA Deployment

Deploy the contents of `dist/` as static assets. Configure the host to serve `index.html` for an application route that does not match a physical asset. Keep real assets, source maps, and status/error files on their normal paths instead of rewriting them.

Verify both paths: open `/work-items` directly after deployment, then reach it through in-app routing from `/`.