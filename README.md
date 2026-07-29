# Vibe Launch Checker

A beginner-friendly local scanner for common launch risks in AI-built web applications.

## Quick start

Open a terminal inside the project you want to scan.

Create the optional configuration:

```bash
vibe-check init
```

Scan the current project and create both reports:

```bash
vibe-check --report
```

The reports are saved inside:

```text
reports/
```

You can still scan a different folder:

```bash
vibe-check ./another-project --report
```

## Current checks

- Hardcoded secret-like values
- Unfinished authentication or security TODOs
- Wildcard CORS configurations
- Localhost URLs left in source code

## Run the unsafe demonstration

```bash
npm install
npm run scan -- ./demo-unsafe-app
```

Expected result:

```text
4 finding(s) detected.
```

## Run the safe demonstration

```bash
npm run scan -- ./demo-safe-app
```

Expected result:

```text
No findings detected by the current checks.
```

## Save a JSON report

Add `--json` to save the scan results:

```bash
npm run scan -- ./demo-unsafe-app --json
```

This creates:

```text
vibe-launch-report.json
```

## Run automated tests

```bash
npm test
```

Expected result:

```text
Test Files  1 passed
Tests       2 passed
```

## Run the TypeScript check

```bash
npm run typecheck
```

A successful typecheck returns to the terminal without showing an `error TS` message.

## Create an HTML report

First create the JSON report:

```bash
npm run scan -- ./demo-unsafe-app --json
```

Then create the HTML report:

```bash
npm run report
```

Open this generated file in a browser:

```text
vibe-launch-report.html
```

## Use as a command

Build and install the command locally:

```bash
npm run build
npm link
```

Scan a project:

```bash
vibe-check ./demo-unsafe-app
```

Save a JSON report:

```bash
vibe-check ./demo-unsafe-app --json
```

## Create JSON and HTML reports together

Run:

```bash
vibe-check ./demo-unsafe-app --report
```

This creates both:

```text
vibe-launch-report.json
vibe-launch-report.html
```

## Command help

Show all available options:

```bash
vibe-check --help
```

Current options:

- `--json` creates a JSON report
- `--report` creates JSON and HTML reports
- `--help` or `-h` displays usage instructions

## Important limitation

This is an early proof of concept. It checks only a small number of patterns and does not guarantee that an application is secure.

Only scan projects that you own or have permission to examine.
