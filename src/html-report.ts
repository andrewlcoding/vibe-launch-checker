import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Severity = "HIGH" | "MEDIUM" | "LOW";

type Finding = {
  id: string;
  title: string;
  severity: Severity;
  file: string;
  line: number;
  explanation: string;
  remediation: string;
};

type ScanReport = {
  scannedAt: string;
  project: string;
  totalFindings: number;
  findings: Finding[];
};

const inputPath = path.resolve("vibe-launch-report.json");
const outputPath = path.resolve("vibe-launch-report.html");

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return character;
    }
  });
}

function isScanReport(value: unknown): value is ScanReport {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const report = value as Partial<ScanReport>;

  return (
    typeof report.scannedAt === "string" &&
    typeof report.project === "string" &&
    typeof report.totalFindings === "number" &&
    Array.isArray(report.findings)
  );
}

function createFindingCards(findings: Finding[]): string {
  if (findings.length === 0) {
    return `
      <section class="empty-state">
        <h2>No findings detected</h2>
        <p>The current checks did not find any known launch risks.</p>
      </section>
    `;
  }

  return findings
    .map((finding) => {
      const severityClass = finding.severity.toLowerCase();

      return `
        <article class="finding">
          <div class="finding-header">
            <span class="severity ${severityClass}">
              ${escapeHtml(finding.severity)}
            </span>

            <h2>${escapeHtml(finding.title)}</h2>
          </div>

          <p class="location">
            ${escapeHtml(finding.file)}:${finding.line}
          </p>

          <div class="section">
            <h3>Why it matters</h3>
            <p>${escapeHtml(finding.explanation)}</p>
          </div>

          <div class="section">
            <h3>Suggested fix</h3>
            <p>${escapeHtml(finding.remediation)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function createHtml(report: ScanReport): string {
  const highCount = report.findings.filter(
    (finding) => finding.severity === "HIGH",
  ).length;

  const mediumCount = report.findings.filter(
    (finding) => finding.severity === "MEDIUM",
  ).length;

  const lowCount = report.findings.filter(
    (finding) => finding.severity === "LOW",
  ).length;

  const scanDate = new Date(report.scannedAt).toLocaleString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>Vibe Launch Checker Report</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #f4f6f8;
      color: #17202a;
      font-family:
        Inter, Arial, Helvetica, sans-serif;
      line-height: 1.5;
    }

    .page {
      width: min(920px, calc(100% - 32px));
      margin: 40px auto;
    }

    .header {
      background: #111827;
      color: white;
      border-radius: 18px;
      padding: 32px;
      margin-bottom: 24px;
    }

    .header h1 {
      margin: 0 0 8px;
      font-size: 32px;
    }

    .header p {
      margin: 4px 0;
      color: #d1d5db;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .summary-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 18px;
    }

    .summary-number {
      display: block;
      font-size: 28px;
      font-weight: 700;
    }

    .summary-label {
      color: #667085;
      font-size: 14px;
    }

    .finding {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
    }

    .finding-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .finding-header h2 {
      margin: 0;
      font-size: 20px;
    }

    .severity {
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
    }

    .severity.high {
      background: #fee2e2;
      color: #991b1b;
    }

    .severity.medium {
      background: #fef3c7;
      color: #92400e;
    }

    .severity.low {
      background: #dbeafe;
      color: #1e40af;
    }

    .location {
      color: #667085;
      font-family: Consolas, monospace;
      font-size: 14px;
    }

    .section {
      border-top: 1px solid #eeeeee;
      margin-top: 16px;
      padding-top: 16px;
    }

    .section h3 {
      margin: 0 0 6px;
      font-size: 15px;
    }

    .section p {
      margin: 0;
    }

    .empty-state {
      background: white;
      border: 1px solid #d1fae5;
      border-radius: 16px;
      padding: 32px;
      text-align: center;
    }

    .empty-state h2 {
      margin-top: 0;
      color: #065f46;
    }

    .footer {
      color: #667085;
      font-size: 13px;
      margin-top: 24px;
      text-align: center;
    }

    @media (max-width: 700px) {
      .summary {
        grid-template-columns: repeat(2, 1fr);
      }

      .finding-header {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  </style>
</head>

<body>
  <main class="page">
    <header class="header">
      <h1>Vibe Launch Checker</h1>
      <p>Project: ${escapeHtml(report.project)}</p>
      <p>Scanned: ${escapeHtml(scanDate)}</p>
    </header>

    <section class="summary">
      <div class="summary-card">
        <span class="summary-number">${report.totalFindings}</span>
        <span class="summary-label">Total findings</span>
      </div>

      <div class="summary-card">
        <span class="summary-number">${highCount}</span>
        <span class="summary-label">High severity</span>
      </div>

      <div class="summary-card">
        <span class="summary-number">${mediumCount}</span>
        <span class="summary-label">Medium severity</span>
      </div>

      <div class="summary-card">
        <span class="summary-number">${lowCount}</span>
        <span class="summary-label">Low severity</span>
      </div>
    </section>

    ${createFindingCards(report.findings)}

    <footer class="footer">
      This automated report does not guarantee that an application is secure.
    </footer>
  </main>
</body>
</html>`;
}

async function main(): Promise<void> {
  try {
    const jsonText = await readFile(inputPath, "utf8");
    const parsedReport: unknown = JSON.parse(jsonText);

    if (!isScanReport(parsedReport)) {
      throw new Error(
        "The JSON report is missing required information.",
      );
    }

    const html = createHtml(parsedReport);

    await writeFile(outputPath, html, "utf8");

    console.log(`HTML report created: ${outputPath}`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown report error";

    console.error(`Could not create HTML report: ${message}`);
    process.exitCode = 1;
  }
}

void main();