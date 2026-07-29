import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

function runScanner(folder: string): string {
  const projectPath = path.resolve(folder);

  const result = spawnSync(
    process.execPath,
    [
      "./node_modules/tsx/dist/cli.mjs",
      "src/index.ts",
      projectPath,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

describe("Vibe Launch Checker", () => {
  it("detects three findings in the unsafe demo", () => {
    const output = runScanner("./demo-unsafe-app");

    expect(output).toContain("3 finding(s) detected.");
    expect(output).toContain("Hardcoded secret-like value");
    expect(output).toContain(
      "Unfinished security or authentication work",
    );
    expect(output).toContain("Wildcard CORS configuration");
  });

  it("detects no findings in the safe demo", () => {
    const output = runScanner("./demo-safe-app");

    expect(output).toContain(
      "No findings detected by the current checks.",
    );
  });
});