#!/usr/bin/env node

import {
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";

import path from "node:path";
import {
  type AppConfig,
  loadConfig,
} from "./config.js";

import { createHtmlReport } from "./report-generator.js";
import { printHelp } from "./help.js";

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

async function collectFiles(
  directory: string,
  ignoredFolders: Set<string>,
): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredFolders.has(entry.name)) {
        const nestedFiles = await collectFiles(
          fullPath,
          ignoredFolders,
        );

        files.push(...nestedFiles);
      }

      continue;
    }

    const extension = path.extname(entry.name);

    if (
      allowedExtensions.has(extension) ||
      entry.name === ".env"
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function scanFile(
  filePath: string,
  content: string,
  projectRoot: string,
  config: AppConfig,
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

    if (
      config.checks.hardcodedSecrets &&
      hardcodedSecretPattern.test(line)
    ) {
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

    if (
      config.checks.securityTodos &&
      unfinishedSecurityPattern.test(line)
    ) {
      findings.push({
        id: `unfinished-security-${displayedFile}-${lineNumber}`,
        title:
          "Unfinished security or authentication work",
        severity: "MEDIUM",
        file: displayedFile,
        line: lineNumber,
        explanation:
          "The code contains unfinished work related to authentication, authorization, permissions, administration, or security.",
        remediation:
          "Finish and test the security requirement before launching the application.",
      });
    }

    if (
      config.checks.wildcardCors &&
      wildcardCorsPattern.test(line)
    ) {
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

    if (
      config.checks.localhostUrls &&
      localhostPattern.test(line)
    ) {
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
    console.log(
      "No findings detected by the current checks.\n",
    );

    return;
  }

  for (const finding of findings) {
    console.log(
      `${finding.severity}: ${finding.title}`,
    );

    console.log(
      `File: ${finding.file}:${finding.line}`,
    );

    console.log(
      `Why it matters: ${finding.explanation}`,
    );

    console.log(
      `Suggested fix: ${finding.remediation}`,
    );

    console.log("");
  }

  console.log(
    `${findings.length} finding(s) detected.\n`,
  );
}

async function saveJsonReport(
  projectRoot: string,
  findings: Finding[],
  outputPath: string,
): Promise<string> {
  const report: ScanReport = {
    scannedAt: new Date().toISOString(),
    project: path.basename(projectRoot),
    totalFindings: findings.length,
    findings,
  };

  await mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await writeFile(
    outputPath,
    JSON.stringify(report, null, 2),
    "utf8",
  );

  console.log(
    `JSON report saved to: ${outputPath}`,
  );

  return outputPath;
}

async function main(): Promise<void> {
  const argumentsList = process.argv.slice(2);

  if (
    argumentsList.includes("--help") ||
    argumentsList.includes("-h")
  ) {
    printHelp();
    return;
  }

  const targetArgument = argumentsList.find(
    (argument) => !argument.startsWith("--"),
  );

  const shouldSaveJson =
    argumentsList.includes("--json") ||
    argumentsList.includes("--report");

  const shouldSaveHtml =
    argumentsList.includes("--report");

  if (!targetArgument) {
    console.error(
      "Missing folder. Example: vibe-check ./demo-unsafe-app",
    );

    process.exitCode = 1;
    return;
  }

  const projectRoot = path.resolve(targetArgument);

  try {
    const config = await loadConfig();

    const files = await collectFiles(
      projectRoot,
      config.ignoredFolders,
    );

    const findings: Finding[] = [];

    for (const file of files) {
      const content = await readFile(file, "utf8");

      findings.push(
        ...scanFile(
          file,
          content,
          projectRoot,
          config,
        ),
      );
    }

    printReport(findings);

    if (shouldSaveJson) {
      const jsonPath = path.join(
        config.reportDirectory,
        "vibe-launch-report.json",
      );

      const htmlPath = path.join(
        config.reportDirectory,
        "vibe-launch-report.html",
      );

      await saveJsonReport(
        projectRoot,
        findings,
        jsonPath,
      );

      if (shouldSaveHtml) {
        await mkdir(config.reportDirectory, {
          recursive: true,
        });

        const createdHtmlPath =
          await createHtmlReport(
            jsonPath,
            htmlPath,
          );

        console.log(
          `HTML report created: ${createdHtmlPath}`,
        );
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown scanning error";

    console.error(
      `Could not scan the folder: ${message}`,
    );

    process.exitCode = 1;
  }
}

void main();