# Vibe Launch Checker

A beginner-friendly local scanner for common launch risks in AI-built web applications.

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

## Important limitation

This is an early proof of concept. It checks only a small number of patterns and does not guarantee that an application is secure.

Only scan projects that you own or have permission to examine.
