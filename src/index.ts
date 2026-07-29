#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHtmlReport } from "./report-generator.js";

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

const allowedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".env",
]);

const ignoredFolders = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
]);

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredFolders.has(entry.name)) {
        const nestedFiles = await collectFiles(fullPath);
        files.push(...nestedFiles);
      }

      continue;
    }

    const extension = path.extname(entry.name);

    if (allowedExtensions.has(extension) || entry.name === ".env") {
      files.push(fullPath);
    }
  }

  return files;
}

function scanFile(
  filePath: string,
  content: string,
  projectRoot: string,
): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split(/\r?\n/);

  const displayedFile = path
    .relative(projectRoot, filePath)
    .replaceAll("\\", "/");

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    const hardcodedSecretPattern =
      /(SERVICE_ROLE|PRIVATE_KEY|SECRET|ADMIN_KEY)\w*\s*=\s*["'`][^"'`]+["'`]/i;

    const unfinishedSecurityPattern =
      /(?:TODO|FIXME).*?(?:auth|authentication|authorization|admin|permission|security)|(?:auth|authentication|authorization|admin|permission|security).*?(?:TODO|FIXME)/i;

    const wildcardCorsPattern =
      /origin\s*:\s*["']\*["']|Access-Control-Allow-Origin\s*[:=]\s*["']?\*/i;

    const localhostPattern =
      /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i;

    if (hardcodedSecretPattern.test(line)) {
      findings.push({
        id: `hardcoded-secret-${displayedFile}-${lineNumber}`,
        title: "Hardcoded secret-like value",
        severity: "HIGH",
        file: displayedFile,
        line: lineNumber,
        explanation:
          "A secret-like value appears to be written directly in the source code.",
        remediation:
          "Move the value into an environment variable and do not commit it to Git.",
      });
    }

    if (unfinishedSecurityPattern.test(line)) {
      findings.push({
        id: `unfinished-security-${displayedFile}-${lineNumber}`,
        title: "Unfinished security or authentication work",
        severity: "MEDIUM",
        file: displayedFile,
        line: lineNumber,
        explanation:
          "The code contains unfinished work related to authentication, authorization, permissions, administration, or security.",
        remediation:
          "Finish and test the security requirement before launching the application.",
      });
    }

    if (wildcardCorsPattern.test(line)) {
      findings.push({
        id: `wildcard-cors-${displayedFile}-${lineNumber}`,
        title: "Wildcard CORS configuration",
        severity: "MEDIUM",
        file: displayedFile,
        line: lineNumber,
        explanation:
          "The application appears to allow requests from every website.",
        remediation:
          "Replace the wildcard with a list of trusted application domains.",
      });
    }

    if (localhostPattern.test(line)) {
      findings.push({
        id: `localhost-url-${displayedFile}-${lineNumber}`,
        title: "Localhost URL left in source code",
        severity: "MEDIUM",
        file: displayedFile,
        line: lineNumber,
        explanation:
          "The code contains a localhost URL that will usually fail after deployment.",
        remediation:
          "Replace the local URL with the production URL or read it from an environment variable.",
      });
    }
  });

  return findings;
}

function printReport(findings: Finding[]): void {
  console.log("\nVibe Launch Checker");
  console.log("===================\n");

  if (findings.length === 0) {
    console.log("No findings detected by the current checks.\n");
    return;
  }

  for (const finding of findings) {
    console.log(`${finding.severity}: ${finding.title}`);
    console.log(`File: ${finding.file}:${finding.line}`);
    console.log(`Why it matters: ${finding.explanation}`);
    console.log(`Suggested fix: ${finding.remediation}`);
    console.log("");
  }

  console.log(`${findings.length} finding(s) detected.\n`);
}

async function saveJsonReport(
  projectRoot: string,
  findings: Finding[],
): Promise<string> {
  const report: ScanReport = {
    scannedAt: new Date().toISOString(),
    project: path.basename(projectRoot),
    totalFindings: findings.length,
    findings,
  };

  const reportPath = path.resolve("vibe-launch-report.json");

  await writeFile(
    reportPath,
    JSON.stringify(report, null, 2),
    "utf8",
  );

  console.log(`JSON report saved to: ${reportPath}`);

  return reportPath;
}

async function main(): Promise<void> {
  const targetArgument = process.argv[2];

  const shouldSaveJson =
    process.argv.includes("--json") ||
    process.argv.includes("--report");

  const shouldSaveHtml =
    process.argv.includes("--report");

  if (!targetArgument) {
    console.error(
      "Missing folder. Example: vibe-check ./demo-unsafe-app",
    );

    process.exitCode = 1;
    return;
  }

  const projectRoot = path.resolve(targetArgument);

  try {
    const files = await collectFiles(projectRoot);
    const findings: Finding[] = [];

    for (const file of files) {
      const content = await readFile(file, "utf8");

      findings.push(...scanFile(file, content, projectRoot));
    }

    printReport(findings);

    if (shouldSaveJson) {
      const jsonPath = await saveJsonReport(
        projectRoot,
        findings,
      );

      if (shouldSaveHtml) {
        const htmlPath = await createHtmlReport(jsonPath);

        console.log(`HTML report created: ${htmlPath}`);
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown scanning error";

    console.error(`Could not scan the folder: ${message}`);
    process.exitCode = 1;
  }
}

void main();