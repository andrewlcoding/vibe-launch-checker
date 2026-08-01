import {
  type InputHTMLAttributes,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  FolderOpen,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import "./ScanPage.css";

type Severity = "HIGH" | "MEDIUM";

type Finding = {
  id: string;
  title: string;
  severity: Severity;
  file: string;
  line: number;
  codeLine: string;
  explanation: string;
  fix: string;
};

type CheckDefinition = {
  id: string;
  title: string;
  severity: Severity;
  pattern: RegExp;
  explanation: string;
  fix: string;
};

type FolderInputProps =
  InputHTMLAttributes<HTMLInputElement> & {
    directory?: string;
    webkitdirectory?: string;
  };

const supportedExtensions = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
];

const ignoredFolders = new Set([
  ".git",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "reports",
]);

const checks: CheckDefinition[] = [
  {
    id: "secret",
    title: "Hardcoded secret-like value",
    severity: "HIGH",
    pattern:
      /(SERVICE_ROLE|PRIVATE_KEY|SECRET|ADMIN_KEY)\w*\s*=\s*["'`][^"'`]+["'`]/i,
    explanation:
      "A private key or secret appears to be written directly inside the source code.",
    fix:
      "Move the value into a server-only environment variable and remove it from the source file.",
  },
  {
    id: "security-todo",
    title: "Unfinished security work",
    severity: "MEDIUM",
    pattern:
      /(?:TODO|FIXME).*?(?:auth|authentication|authorization|admin|permission|security)|(?:auth|authentication|authorization|admin|permission|security).*?(?:TODO|FIXME)/i,
    explanation:
      "The project contains unfinished work related to authentication, permissions, administration, or security.",
    fix:
      "Finish and test the security requirement before launching the application.",
  },
  {
    id: "cors",
    title: "Wildcard CORS configuration",
    severity: "MEDIUM",
    pattern:
      /origin\s*:\s*["']\*["']|Access-Control-Allow-Origin\s*[:=]\s*["']?\*/i,
    explanation:
      "The application appears to accept requests from every website.",
    fix:
      "Replace the wildcard with an explicit list of trusted production domains.",
  },
  {
    id: "localhost",
    title: "Localhost URL left in the project",
    severity: "MEDIUM",
    pattern: /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i,
    explanation:
      "A development-only URL may stop working when the application is deployed.",
    fix:
      "Move the URL into an environment variable and provide the real production URL.",
  },
];

function FolderInput(props: FolderInputProps) {
  return <input {...props} />;
}

function isSupportedFile(file: File): boolean {
  const path = (
    file.webkitRelativePath || file.name
  )
    .split("\\").join("/")
    .toLowerCase();

  const pathParts = path.split("/");

  if (
    pathParts.some((part) =>
      ignoredFolders.has(part),
    )
  ) {
    return false;
  }

  const fileName =
    pathParts[pathParts.length - 1] ?? "";

  return (
    supportedExtensions.some((extension) =>
      fileName.endsWith(extension),
    ) || fileName.startsWith(".env")
  );
}

function scanFile(
  fileName: string,
  contents: string,
): Finding[] {
  const findings: Finding[] = [];
  const lines = contents.split(/\r?\n/);

  lines.forEach((line, index) => {
    checks.forEach((check) => {
      if (!check.pattern.test(line)) {
        return;
      }

      findings.push({
        id: `${check.id}-${fileName}-${index + 1}`,
        codeLine: line.trim(),
        title: check.title,
        severity: check.severity,
        file: fileName,
        line: index + 1,
        explanation: check.explanation,
        fix: check.fix,
      });
    });
  });

  return findings;
}

function ScanPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [copiedFindingId, setCopiedFindingId] =
  useState<string | null>(null);
  const [copiedAll, setCopiedAll] =
  useState(false);
  const [message, setMessage] = useState(
    "Select the project folder you want to review.",
  );

  const highCount = useMemo(
    () =>
      findings.filter(
        (finding) => finding.severity === "HIGH",
      ).length,
    [findings],
  );

  const mediumCount = useMemo(
    () =>
      findings.filter(
        (finding) => finding.severity === "MEDIUM",
      ).length,
    [findings],
  );

  const score = Math.max(
    0,
    100 - highCount * 25 - mediumCount * 10,
  );

  function handleFiles(
    selectedFiles: FileList | null,
  ): void {
    if (!selectedFiles) {
      return;
    }

    const allFiles = Array.from(selectedFiles);
    const acceptedFiles =
      allFiles.filter(isSupportedFile);
    const skippedCount =
      allFiles.length - acceptedFiles.length;

    setFiles(acceptedFiles);
    setFindings([]);
    setHasScanned(false);

    if (acceptedFiles.length === 0) {
      setMessage(
        "No supported code files were found in that folder.",
      );
      return;
    }

    const skippedText =
      skippedCount > 0
        ? ` ${skippedCount} unsupported or generated file${
            skippedCount === 1 ? " was" : "s were"
          } skipped.`
        : "";

    setMessage(
      `${acceptedFiles.length} supported file${
        acceptedFiles.length === 1 ? "" : "s"
      } ready to scan.${skippedText}`,
    );
  }

  async function runScan(): Promise<void> {
    if (files.length === 0) {
      return;
    }

    setIsScanning(true);
    setMessage("Scanning selected project...");

    try {
      const results: Finding[] = [];

      for (const file of files) {
        const contents = await file.text();
        const displayedName =
          file.webkitRelativePath || file.name;

        results.push(
          ...scanFile(displayedName, contents),
        );
      }

      await new Promise((resolve) =>
        window.setTimeout(resolve, 450),
      );

      setFindings(results);
      setHasScanned(true);
      setMessage(
        results.length === 0
          ? "Scan complete. No matching launch issues were found."
          : `Scan complete. ${results.length} issue${
              results.length === 1 ? "" : "s"
            } need attention.`,
      );
    } catch {
      setMessage(
        "The selected project could not be scanned.",
      );
    } finally {
      setIsScanning(false);
    }
  }
async function copyRepairPrompt(
  finding: Finding,
): Promise<void> {
  const prompt = `Fix this launch issue in ${finding.file} at line ${finding.line}.

Issue: ${finding.title}
Flagged code:
${finding.codeLine}
Why it matters:
${finding.explanation}

Required change:
${finding.fix}

Make the smallest safe change possible. Preserve the application's existing behavior and explain what you changed.`;

  try {
    await navigator.clipboard.writeText(prompt);
    setCopiedFindingId(finding.id);

    window.setTimeout(() => {
      setCopiedFindingId(null);
    }, 1800);
  } catch {
    setMessage(
      "The repair prompt could not be copied.",
    );
  }
}
async function copyAllRepairPrompts(): Promise<void> {
  const prompts = findings.map((finding, index) => {
    return `ISSUE ${index + 1}

File: ${finding.file}
Line: ${finding.line}
Issue: ${finding.title}
Flagged code:
${finding.codeLine}
Why it matters:
${finding.explanation}

Required change:
${finding.fix}

Make the smallest safe change possible. Preserve the application's existing behavior and explain what you changed.`;
  });

  try {
    await navigator.clipboard.writeText(
      prompts.join("\n\n--------------------\n\n"),
    );

    setCopiedAll(true);

    window.setTimeout(() => {
      setCopiedAll(false);
    }, 1800);
  } catch {
    setMessage(
      "The repair prompts could not be copied.",
    );
  }
}
function downloadReport(): void {
  const generatedAt = new Date().toLocaleString();

  const status =
    findings.length === 0
      ? "No matching launch issues found."
      : `${findings.length} issue${
          findings.length === 1 ? "" : "s"
        } need attention.`;

  const findingSections =
    findings.length === 0
      ? "No matching issues were found by the current checks."
      : findings
          .map((finding, index) => {
            return `### Issue ${index + 1}: ${finding.title}

- Severity: ${finding.severity}
- File: ${finding.file}
- Line: ${finding.line}

Flagged code:

    ${finding.codeLine || "(empty line)"}

Why it matters:

${finding.explanation}

Recommended fix:

${finding.fix}`;
          })
          .join("\n\n---\n\n");

  const report = `# Vibe Launch Checker Report

Generated: ${generatedAt}

## Summary

- Launch score: ${score}/100
- Files scanned: ${files.length}
- High-severity findings: ${highCount}
- Medium-severity findings: ${mediumCount}
- Status: ${status}

## Findings

${findingSections}

---

This automated scan checks only the rules currently supported by Vibe Launch Checker. It does not guarantee that an application is completely secure.
`;

  const reportFile = new Blob([report], {
    type: "text/markdown;charset=utf-8",
  });

  const reportUrl =
    URL.createObjectURL(reportFile);

  const downloadLink =
    document.createElement("a");

  downloadLink.href = reportUrl;
  downloadLink.download = `vibe-launch-report-${new Date()
    .toISOString()
    .slice(0, 10)}.md`;

  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  URL.revokeObjectURL(reportUrl);
}
  return (
    <div className="scan-page">
      <header className="scan-topbar">
        <Link className="scan-brand" to="/">
          <span>
            <ShieldCheck size={18} />
          </span>
          Vibe Launch Checker
        </Link>

        <Link className="back-link" to="/">
          <ArrowLeft size={16} />
          Back to home
        </Link>
      </header>

      <main className="scan-layout">
        <section className="scan-main">
          <div className="scan-heading">
            <p>PRIVATE BROWSER SCAN</p>
            <h1>Review a project before launch.</h1>
            <span>
              Choose a project folder, run the scan, and
              review each matching issue.
            </span>
          </div>

          <section className="upload-panel">
            <div className="upload-icon">
              <FolderOpen size={25} />
            </div>

            <h2>Select a project folder</h2>

            <p>
              The scanner reviews supported source files
              and skips generated folders such as
              node_modules, dist, and build.
            </p>

            <label className="choose-files">
              Choose project folder
              <FolderInput
                directory=""
                multiple
                onChange={(event) =>
                  handleFiles(
                    event.currentTarget.files,
                  )
                }
                type="file"
                webkitdirectory=""
              />
            </label>

            <div className="selection-status">
              <FileCode2 size={16} />
              {message}
            </div>

            <button
              className="run-scan"
              disabled={
                files.length === 0 || isScanning
              }
              onClick={() => void runScan()}
              type="button"
            >
              {isScanning ? (
                <>
                  <ScanLine
                    className="scan-spin"
                    size={17}
                  />
                  Scanning
                </>
              ) : (
                <>
                  <ScanLine size={17} />
                  Run launch scan
                </>
              )}
            </button>
          </section>

          {hasScanned && (
            <section className="scan-results">
              <div className="results-summary">
                <div>
                  <span>Launch score</span>
                  <strong>{score}</strong>
                  <small>/100</small>
                </div>

                <div className="results-actions">
  <div className="results-counts">
    <span>{highCount} high</span>
    <span>{mediumCount} medium</span>
  </div>

  <div className="report-buttons">
    {findings.length > 0 && (
      <button
        className="copy-all-button"
        onClick={() =>
          void copyAllRepairPrompts()
        }
        type="button"
      >
        {copiedAll ? (
          <Check size={14} />
        ) : (
          <Copy size={14} />
        )}

        {copiedAll
          ? "All copied"
          : "Copy all fixes"}
      </button>
    )}

    <button
      className="download-report-button"
      onClick={downloadReport}
      type="button"
    >
      <Download size={14} />
      Download report
    </button>
  </div>
</div>
              </div>

              {findings.length === 0 ? (
                <div className="scan-empty">
                  <CheckCircle2 size={24} />
                  <div>
                    <h3>No launch issues found</h3>
                    <p>
                      No matching problems were found by
                      the current checks.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="scan-findings">
                  {findings.map((finding) => (
                    <article key={finding.id}>
                      <div className="finding-row">
                        <span
                          className={`scan-risk ${finding.severity.toLowerCase()}`}
                        >
                          {finding.severity}
                        </span>

                        <code>
                          {finding.file}:{finding.line}
                        </code>
                      </div>

                      <h3>{finding.title}</h3>

                      <div className="code-evidence">
  <span>Flagged code</span>
  <code>
    {finding.codeLine || "(empty line)"}
  </code>
</div>

                      <div className="finding-copy">
  <div>
    <span>Why it matters</span>
    <p>{finding.explanation}</p>
  </div>

  <div>
    <span>Recommended fix</span>
    <p>{finding.fix}</p>
  </div>
</div>

<button
  className="copy-repair-button"
  onClick={() =>
    void copyRepairPrompt(finding)
  }
  type="button"
>
  {copiedFindingId === finding.id ? (
    <Check size={15} />
  ) : (
    <Copy size={15} />
  )}

  {copiedFindingId === finding.id
    ? "Copied"
    : "Copy repair prompt"}
</button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>

        <aside className="scan-sidebar">
          <div className="privacy-card">
            <LockKeyhole size={20} />
            <h2>Local processing</h2>
            <p>
              This version reads the selected files inside
              your browser instead of uploading them to a
              server.
            </p>
          </div>

          <div className="checks-card">
            <p>CURRENT CHECKS</p>

            <ol>
              <li>Exposed secret-like values</li>
              <li>Unfinished security work</li>
              <li>Wildcard CORS settings</li>
              <li>Localhost production URLs</li>
            </ol>

            <div className="limitation">
              <AlertTriangle size={15} />
              Automated checks do not guarantee complete
              application security.
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default ScanPage;
