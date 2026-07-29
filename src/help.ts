export function printHelp(): void {
  console.log(`
Vibe Launch Checker

Usage:
  vibe-check <project-folder> [options]

Examples:
  vibe-check ./my-app
  vibe-check ./my-app --json
  vibe-check ./my-app --report

Options:
  --json       Create a JSON report
  --report     Create both JSON and HTML reports
  --help, -h   Show this help message

Configuration:
  Optional settings can be placed in:
  vibe-check.config.json

Important:
  This tool checks common launch risks.
  It does not guarantee that an application is secure.
`);
}