import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileCode2,
  FolderOpen,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { Link, Route, Routes } from "react-router";
import ScanPage from "./pages/ScanPage";

type Severity = "HIGH" | "MEDIUM";

type Finding = {
  id: string;
  title: string;
  severity: Severity;
  file: string;
  line: number;
  explanation: string;
  fix: string;
  repairPrompt: string;
};

type CheckDefinition = {
  id: string;
  title: string;
  severity: Severity;
  pattern: RegExp;
  explanation: string;
  fix: string;
};

const supportedExtensions = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".env",
];

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
    pattern:
      /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i,
    explanation:
      "A development-only URL may stop working when the application is deployed.",
    fix:
      "Move the URL into an environment variable and provide the real production URL.",
  },
];

const examplePrompt = `Fix this launch-readiness issue in my project:

Issue: Supabase service-role key may be exposed
File: src/config.ts
Line: 4

Required fix:
Remove the service-role key from client-side code and load it only from a secure server environment.

Instructions:
1. Make the smallest safe change.
2. Do not modify unrelated files.
3. Do not expose private keys or secrets.
4. Explain exactly what changed.
5. Tell me how to verify the fix.`;

function createRepairPrompt(
  finding: Omit<Finding, "repairPrompt">,
): string {
  return `Fix this launch-readiness issue in my project:

Issue: ${finding.title}
File: ${finding.file}
Line: ${finding.line}

Why it matters:
${finding.explanation}

Required fix:
${finding.fix}

Instructions:
1. Make the smallest safe change.
2. Do not modify unrelated files.
3. Do not expose private keys or secrets.
4. Explain exactly what you changed.
5. Tell me how to verify that the issue is fixed.`;
}

function isSupportedFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();

  return supportedExtensions.some((extension) =>
    lowerName.endsWith(extension),
  );
}

function scanFile(
  fileName: string,
  contents: string,
): Finding[] {
  const results: Finding[] = [];
  const lines = contents.split(/\r?\n/);

  lines.forEach((line, index) => {
    checks.forEach((check) => {
      if (!check.pattern.test(line)) {
        return;
      }

      const findingWithoutPrompt = {
        id: `${check.id}-${fileName}-${index + 1}`,
        title: check.title,
        severity: check.severity,
        file: fileName,
        line: index + 1,
        explanation: check.explanation,
        fix: check.fix,
      };

      results.push({
        ...findingWithoutPrompt,
        repairPrompt: createRepairPrompt(
          findingWithoutPrompt,
        ),
      });
    });
  });

  return results;
}

function HomePage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [fileCount, setFileCount] = useState(0);
  const [hasScanned, setHasScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState("");

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

  async function copyText(
    id: string,
    text: string,
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);

      window.setTimeout(() => {
        setCopiedId(null);
      }, 1800);
    } catch {
      setMessage(
        "The repair prompt could not be copied automatically.",
      );
    }
  }

  async function scanSelectedFiles(
    selectedFiles: FileList | null,
  ): Promise<void> {
    if (!selectedFiles) {
      return;
    }

    const files = Array.from(selectedFiles).filter(
      isSupportedFile,
    );

    if (files.length === 0) {
      setMessage("Choose at least one supported code file.");
      return;
    }

    setMessage("");
    setIsScanning(true);
    setHasScanned(false);
    setCopiedId(null);

    try {
      const newFindings: Finding[] = [];

      for (const file of files) {
        const contents = await file.text();
        const displayedName =
          file.webkitRelativePath || file.name;

        newFindings.push(
          ...scanFile(displayedName, contents),
        );
      }

      await new Promise((resolve) =>
        window.setTimeout(resolve, 500),
      );

      setFindings(newFindings);
      setFileCount(files.length);
      setHasScanned(true);

      window.setTimeout(() => {
        document
          .querySelector("#results")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);
    } catch {
      setMessage("The selected files could not be scanned.");
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <div className="site">
      <header className="site-header">
        <a className="wordmark" href="#top">
          <span className="wordmark-icon">
            <ShieldCheck size={18} strokeWidth={2.1} />
          </span>
          <span>App Runway</span>
        </a>

        <nav aria-label="Main navigation">
          <Link to="/scan">Scanner</Link>
         <a href="#why">Why AppRunway</a>
          <a href="#checks">Checks</a>
          <a href="#process">Process</a>
          <a href="#example">Example</a>
        </nav>

        <Link className="header-action" to="/scan">
  Run preflight
  <ArrowRight size={15} />
</Link>
      </header>

      <main id="top">
        <section className="hero">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <p className="overline">
              Launch review for AI-built software
            </p>

            <h1>
              Know what could break before you launch.
            </h1>

            <p className="hero-intro">
              Scan your AI-built app locally for exposed secrets,
unfinished security work, development settings, and
other common launch blockers. AppRunway explains each
finding and creates repair instructions for your coding
agent.
            </p>

            <div className="hero-actions">
              <label className="primary-action">
                {isScanning ? (
                  <>
                    <ScanLine className="spin" size={17} />
                    Scanning
                  </>
                ) : (
                  <>
                    <FolderOpen size={17} />
                    Select code files
                  </>
                )}

                <input
                  accept=".ts,.tsx,.js,.jsx,.json,.env"
                  disabled={isScanning}
                  multiple
                  onChange={(event) =>
                    void scanSelectedFiles(
                      event.currentTarget.files,
                    )
                  }
                  type="file"
                />
              </label>

              <a className="text-action" href="#example">
                View a sample finding
                <ArrowRight size={16} />
              </a>
            </div>

            <div className="hero-notes">
              <span>
                <LockKeyhole size={14} />
                Runs in your browser
              </span>
              <span>No account</span>
              <span>No source-code upload</span>
            </div>

            {message && (
              <p className="message">
                <AlertTriangle size={15} />
                {message}
              </p>
            )}
          </motion.div>

          <motion.div
            className="scan-console"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
          >
            <div className="console-header">
              <div>
                <span className="console-label">
                  CURRENT REVIEW
                </span>
                <strong>
                  {hasScanned
                    ? `${fileCount} file${
                        fileCount === 1 ? "" : "s"
                      }`
                    : "Example project"}
                </strong>
              </div>

              <span className="console-state">
                <span />
                {isScanning
                  ? "Scanning"
                  : hasScanned
                    ? "Complete"
                    : "Preview"}
              </span>
            </div>

            <div className="console-score">
              <div>
                <span>Launch score</span>
                <strong>{hasScanned ? score : 82}</strong>
                <small>/100</small>
              </div>

              <div className="score-copy">
                {hasScanned && highCount > 0
                  ? "Resolve the high-risk finding before release."
                  : "A focused review of common launch mistakes."}
              </div>
            </div>

            <div className="console-progress">
              <motion.div
                animate={{
                  width: `${hasScanned ? score : 82}%`,
                }}
                initial={{ width: 0 }}
                transition={{ duration: 0.75 }}
              />
            </div>

            <div className="console-table">
              <div className="table-row table-heading">
                <span>CHECK</span>
                <span>STATUS</span>
              </div>

              <div className="table-row">
                <span>
                  <CheckCircle2 size={16} />
                  Browser privacy
                </span>
                <strong className="status-pass">PASSED</strong>
              </div>

              <div className="table-row">
                <span>
                  {hasScanned && highCount > 0 ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Exposed secrets
                </span>
                <strong
                  className={
                    hasScanned && highCount > 0
                      ? "status-fail"
                      : "status-pass"
                  }
                >
                  {hasScanned && highCount > 0
                    ? `${highCount} FOUND`
                    : "PASSED"}
                </strong>
              </div>

              <div className="table-row">
                <span>
                  {hasScanned && mediumCount > 0 ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Production configuration
                </span>
                <strong
                  className={
                    hasScanned && mediumCount > 0
                      ? "status-warn"
                      : "status-pass"
                  }
                >
                  {hasScanned && mediumCount > 0
                    ? `${mediumCount} FOUND`
                    : "PASSED"}
                </strong>
              </div>
            </div>

            <div className="console-footer">
              <span>
                <FileCode2 size={15} />
                TypeScript · JavaScript · JSON · ENV
              </span>
              <span>LOCAL REVIEW</span>
            </div>
          </motion.div>
        </section>

        <section className="capability-bar">
          <div>
            <span>01</span>
            <strong>Local processing</strong>
            <small>Files remain on the device.</small>
          </div>
          <div>
            <span>02</span>
            <strong>Actionable findings</strong>
            <small>Each issue includes a focused correction.</small>
          </div>
          <div>
            <span>03</span>
            <strong>Agent-ready prompts</strong>
            <small>Copy the fix into your coding workflow.</small>
          </div>
        </section>

        <AnimatePresence>
          {hasScanned && (
            <motion.section
              className="results"
              id="results"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="section-header">
                <div>
                  <p className="overline">Scan results</p>
                  <h2>
                    {findings.length === 0
  ? "No launch issues found."
  : findings.length === 1
    ? "1 issue needs attention."
    : `${findings.length} issues need attention.`}
                  </h2>
                </div>

                <div className="result-tally">
                  <span>{highCount} HIGH</span>
                  <span>{mediumCount} MEDIUM</span>
                </div>
              </div>

              {findings.length === 0 ? (
                <div className="empty-result">
                  <CheckCircle2 size={28} />
                  <div>
                    <strong>Current checks passed</strong>
                    <p>
                      No matching problems were found.
                      Automated review does not guarantee
                      complete application security.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="finding-list">
                  {findings.map((finding, index) => (
                    <motion.article
                      className="finding"
                      key={finding.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: index * 0.05,
                      }}
                    >
                      <div className="finding-index">
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      <div className="finding-content">
                        <div className="finding-meta">
                          <span
                            className={`risk ${finding.severity.toLowerCase()}`}
                          >
                            {finding.severity}
                          </span>
                          <code>
                            {finding.file}:{finding.line}
                          </code>
                        </div>

                        <h3>{finding.title}</h3>

                        <div className="finding-columns">
                          <div>
                            <span className="detail-label">
                              WHY IT MATTERS
                            </span>
                            <p>{finding.explanation}</p>
                          </div>
                          <div>
                            <span className="detail-label">
                              RECOMMENDED FIX
                            </span>
                            <p>{finding.fix}</p>
                          </div>
                        </div>

                        <button
                          className="copy-action"
                          onClick={() =>
                            void copyText(
                              finding.id,
                              finding.repairPrompt,
                            )
                          }
                          type="button"
                        >
                          {copiedId === finding.id ? (
                            <>
                              <Check size={16} />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy size={16} />
                              Copy repair prompt
                            </>
                          )}
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

<section className="product-value" id="why">
  <div className="product-value-heading">
    <p className="section-label">
      WHY APPRUNWAY
    </p>

    <h2>
      A private preflight checker for AI-built apps.
    </h2>

    <p>
      AI coding tools make it possible to build an app
      quickly, but they do not guarantee that the project
      is ready for production. AppRunway reviews your
      selected project files for common launch blockers
      before your app goes live.
    </p>
  </div>

  <div className="product-value-grid">
    <article>
      <span>01</span>
      <h3>Private by default</h3>

      <p>
        Your project is reviewed locally inside your
        browser. The current version does not upload your
        source code to an AppRunway server.
      </p>
    </article>

    <article>
      <span>02</span>
      <h3>Built for AI builders</h3>

      <p>
        AppRunway is designed for people building with
        Codex, Claude Code, Cursor, Lovable, Replit, Bolt,
        v0, and other AI development tools.
      </p>
    </article>

    <article>
      <span>03</span>
      <h3>From finding to fix</h3>

      <p>
        Every result includes the file, line number,
        flagged code, explanation, and a repair prompt you
        can paste into your coding agent.
      </p>
    </article>
  </div>

  <div className="product-value-note">
    <strong>Why choose AppRunway?</strong>
    It focuses on the final gap between building an app
    and safely launching it. Instead of overwhelming
    beginners with an enterprise security dashboard, it
    provides a simple preflight workflow: select your
    project, understand the risks, and copy the fixes.
  </div>

  <p className="product-limitation">
    AppRunway helps identify common launch mistakes. It
    does not guarantee complete application security and
    does not replace testing or a professional security
    review.
  </p>
</section>

        <section className="checks-section" id="checks">
          <div className="section-header">
            <div>
              <p className="overline">Current coverage</p>
              <h2>
                Four focused checks. No inflated claims.
              </h2>
            </div>
            <p className="section-aside">
              The first version targets common mistakes made
              while moving an AI-built web app from local
              development to a public launch.
            </p>
          </div>

          <div className="checks-list">
            {[
              [
                "01",
                "Exposed secrets",
                "Flags secret-like values written directly into source files.",
              ],
              [
                "02",
                "Unfinished security work",
                "Finds TODO and FIXME notes tied to authentication, permissions, or administration.",
              ],
              [
                "03",
                "Wildcard CORS",
                "Identifies configurations that appear to accept requests from every origin.",
              ],
              [
                "04",
                "Local development URLs",
                "Finds localhost addresses that may break after deployment.",
              ],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <ArrowRight size={17} />
              </article>
            ))}
          </div>
        </section>

        <section className="process-section" id="process">
          <div className="process-intro">
            <p className="overline">The process</p>
            <h2>Review. Repair. Verify.</h2>
            <p>
              The interface keeps the workflow obvious for
              people who built an app with AI but do not have
              a security team.
            </p>
          </div>

          <div className="process-steps">
            <article>
              <span>01</span>
              <div>
                <h3>Select the project files</h3>
                <p>
                  Run the current checks directly in the
                  browser without creating an account.
                </p>
              </div>
            </article>

            <article>
              <span>02</span>
              <div>
                <h3>Read the evidence</h3>
                <p>
                  See the file, line number, risk explanation,
                  and smallest recommended correction.
                </p>
              </div>
            </article>

            <article>
              <span>03</span>
              <div>
                <h3>Copy the repair prompt</h3>
                <p>
                  Paste the prompt into your preferred coding
                  agent and keep unrelated code unchanged.
                </p>
              </div>
            </article>

            <article>
              <span>04</span>
              <div>
                <h3>Scan again</h3>
                <p>
                  Verify that the finding disappeared before
                  publishing the application.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="example-section" id="example">
          <div className="example-heading">
            <p className="overline">Example finding</p>
            <h2>
              Useful output, not a wall of security jargon.
            </h2>
          </div>

          <article className="example-finding">
            <div className="example-top">
              <span className="risk high">HIGH</span>
              <code>src/config.ts:4</code>
            </div>

            <h3>Supabase service-role key may be exposed</h3>

            <div className="example-grid">
              <div>
                <span className="detail-label">
                  WHY IT MATTERS
                </span>
                <p>
                  This key can bypass normal database
                  protections and should not be included in
                  frontend code.
                </p>
              </div>

              <div>
                <span className="detail-label">
                  RECOMMENDED FIX
                </span>
                <p>
                  Remove it from client-side code and load it
                  only from a secure server environment.
                </p>
              </div>
            </div>

            <button
              className="copy-action inverted"
              onClick={() =>
                void copyText("example", examplePrompt)
              }
              type="button"
            >
              {copiedId === "example" ? (
                <>
                  <Check size={16} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy example prompt
                </>
              )}
            </button>
          </article>
        </section>

        <section className="final-section">
          <div>
            <p className="overline">Private browser review</p>
            <h2>Check the code before the launch.</h2>
          </div>

          <label className="final-action">
            Select code files
            <ArrowRight size={17} />
            <input
              accept=".ts,.tsx,.js,.jsx,.json,.env"
              disabled={isScanning}
              multiple
              onChange={(event) =>
                void scanSelectedFiles(
                  event.currentTarget.files,
                )
              }
              type="file"
            />
          </label>
        </section>
      </main>

      <footer>
        <a className="wordmark" href="#top">
          <span className="wordmark-icon">
            <ShieldCheck size={18} />
          </span>
          <span>App Runway</span>
        </a>

        <p>
          Automated checks reduce common launch risks but do
          not guarantee complete application security.
        </p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/scan" element={<ScanPage />} />
    </Routes>
  );
}

export default App;
