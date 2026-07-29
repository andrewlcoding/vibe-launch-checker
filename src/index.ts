import { readdir, readFile } from "node:fs/promises";
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
          "The code contains a TODO or FIXME related to authentication, authorization, permissions, administration, or security.",
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

async function main(): Promise<void> {
  const targetArgument = process.argv[2];

  if (!targetArgument) {
    console.error(
      "Missing folder. Example: npm run scan -- ./demo-unsafe-app",
    );
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown scanning error";

    console.error(`Could not scan the folder: ${message}`);
  }
}

void main();