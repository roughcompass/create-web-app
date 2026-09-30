# create-web-app

`create-web-app` generates the enterprise model React and Salt application. The current repository contains the generator foundation; CLI options and the complete template are delivered by the tracked OpenSpec implementation.

See [CLI contract](docs/cli.md) for flags, automation, JSON results, exit codes, cancellation, recovery, and security boundaries.

## Development

Requires Node.js 24 and npm 11.

```sh
npm ci --ignore-scripts
npm run check
npm run ci
npm run build
node dist/cli.js --version
```

The package contains no lifecycle scripts. Build explicitly before inspecting or publishing a package.

## Local registry

Start the isolated development registry on port 4874:

```sh
npm run registry
```

The command prints temporary `CREATE_WEB_APP_NPM_REGISTRY` and `CREATE_WEB_APP_NPM_TOKEN` values. Accounts, package storage, and tokens remain under ignored `tmp/` paths. The registry has no public uplink.