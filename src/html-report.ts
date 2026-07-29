import { createHtmlReport } from "./report-generator.js";

async function main(): Promise<void> {
  try {
    const outputPath = await createHtmlReport();

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
