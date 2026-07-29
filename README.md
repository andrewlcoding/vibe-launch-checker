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