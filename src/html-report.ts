import path from "node:path";

import { loadConfig } from "./config.js";
import { createHtmlReport } from "./report-generator.js";

async function main(): Promise<void> {
  try {
    const config = await loadConfig();

    const jsonPath = path.join(
      config.reportDirectory,
      "vibe-launch-report.json",
    );

    const htmlPath = path.join(
      config.reportDirectory,
      "vibe-launch-report.html",
    );

    const outputPath = await createHtmlReport(
      jsonPath,
      htmlPath,
    );

    console.log(`HTML report created: ${outputPath}`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown report error";

    console.error(
      `Could not create HTML report: ${message}`,
    );

    process.exitCode = 1;
  }
}

void main();