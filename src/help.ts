export function printHelp(): void {
  console.log(`
Vibe Launch Checker

Quick start:
  1. Open a terminal inside your project
  2. Run: vibe-check init
  3. Run: vibe-check --report

Usage:
  vibe-check [project-folder] [options]
  vibe-check init

Examples:
  vibe-check
  vibe-check --report
  vibe-check ./my-app
  vibe-check ./my-app --report

Commands:
  init         Create a configuration file

Options:
  --json       Create a JSON report
  --report     Create JSON and HTML reports
  --help, -h   Show this help message

Generated reports:
  reports/vibe-launch-report.json
  reports/vibe-launch-report.html

Important:
  This tool checks common launch risks.
  It does not guarantee that an application is secure.
`);
}