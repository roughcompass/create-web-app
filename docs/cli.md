# CLI Contract

`create-web-app` supports guided use by developers and explicit, prompt-free use by automation. It generates only from the reviewed template embedded in the installed package.

## Commands

Show help or the exact generator/template release:

```sh
create-web-app --help
create-web-app --version
```

Generate without dependency installation or Git initialization:

```sh
create-web-app example-app --directory example-app --no-install --no-git
```

Generate the same application for an agent and emit one JSON document:

```sh
create-web-app --name example-app --display-name "Example App" --directory example-app --no-install --no-git --json
```

Run `create-web-app` without a package name for guided prompts. The CLI explains package name, display name, destination, installation, and Git initialization, then displays the complete plan before asking for final confirmation.

## Options

| Option | Meaning |
| --- | --- |
| `<name>` or `--name <package>` | Valid plain or scoped npm package name |
| `--display-name <name>` | Human-readable application name; defaults from the package name |
| `--directory <path>` | Child destination under the invocation directory |
| `--install` / `--no-install` | Run or skip script-disabled `npm ci` after activation |
| `--git` / `--no-git` | Run or skip `git init --initial-branch=main` |
| `-y`, `--yes` | Accept defaults without prompts; requires a package name |
| `--json` | Disable prompts and write one canonical result to stdout |
| `-h`, `--help` | Print usage |
| `-v`, `--version` | Print the generator/template version |

Installation and Git initialization default to enabled. Automation must provide the name and should state both choices explicitly.

## JSON Results

Success uses `create-web-app.cli-result` version 1 and includes generator/template versions, normalized options, destination, performed actions, rendered file count, recovery path, and verification commands. Failure uses the same envelope with `success: false`, a stable error code and message, and an optional recovery path. JSON mode writes no prompts or explanatory text around that document.

Exit status `0` means success, help, or version output. Status `2` identifies invalid invocation. Status `1` identifies cancellation or a generation, installation, Git, or internal failure.

## Cancellation and Recovery

Declining the final guided confirmation writes no project files. Rendering occurs in a sibling staging directory and activates atomically. Rendering failures remove staging unless cleanup itself fails, in which case `recoveryPath` identifies the retained directory. Installation and Git happen after activation; a failure preserves the generated repository and reports its destination as `recoveryPath`.

The CLI never overwrites a non-empty destination. Resolve conflicts by choosing a new empty child directory; do not delete or merge existing work automatically.

## Trust Boundary

- Templates are packaged, versioned, and digest-verified. The CLI does not fetch remote templates.
- Package installation uses `npm ci --ignore-scripts` and never interpolates options into a shell command.
- Git initialization uses a fixed argument array and does not create a commit or remote.
- Registry addresses and credentials come from environment/CI configuration and never enter generated files.
- Structured JSON and YAML substitutions are parsed as data. Text substitutions are limited to named template placeholders.
- Generated output is scanned for unresolved placeholders, local absolute paths, and credential markers before activation.