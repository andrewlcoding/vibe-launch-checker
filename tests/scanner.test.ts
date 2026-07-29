import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

function runScanner(folder: string): string {
  const projectPath = path.resolve(folder);
  const tsxPath = path.resolve("node_modules/tsx/dist/cli.mjs");

  const result = spawnSync(
    process.execPath,
    [tsxPath, "src/index.ts", projectPath],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

describe("Vibe Launch Checker", () => {
  it("detects four findings in the unsafe demo", () => {
    const output = runScanner("./demo-unsafe-app");

    expect(output).toContain("4 finding(s) detected.");
    expect(output).toContain("Hardcoded secret-like value");
    expect(output).toContain(
      "Unfinished security or authentication work",
    );
    expect(output).toContain("Wildcard CORS configuration");
    expect(output).toContain("Localhost URL left in source code");
  });

  it("detects no findings in the safe demo", () => {
    const output = runScanner("./demo-safe-app");

    expect(output).toContain(
      "No findings detected by the current checks.",
    );
  });
});