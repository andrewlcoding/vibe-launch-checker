import { readFile } from "node:fs/promises";
import path from "node:path";

export type CheckSettings = {
  hardcodedSecrets: boolean;
  securityTodos: boolean;
  wildcardCors: boolean;
  localhostUrls: boolean;
};

export type AppConfig = {
  ignoredFolders: Set<string>;
  reportDirectory: string;
  checks: CheckSettings;
};

type UserConfig = {
  ignoredFolders?: unknown;
  reportDirectory?: unknown;
  checks?: unknown;
};

const defaultIgnoredFolders = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
];

const defaultChecks: CheckSettings = {
  hardcodedSecrets: true,
  securityTodos: true,
  wildcardCors: true,
  localhostUrls: true,
};

function createDefaultConfig(): AppConfig {
  return {
    ignoredFolders: new Set(defaultIgnoredFolders),
    reportDirectory: process.cwd(),
    checks: { ...defaultChecks },
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function loadConfig(): Promise<AppConfig> {
  const configPath = path.resolve("vibe-check.config.json");
  const config = createDefaultConfig();

  let text: string;

  try {
    text = await readFile(configPath, "utf8");
  } catch (error) {
    const code =
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;

    if (code === "ENOENT") {
      return config;
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "vibe-check.config.json contains invalid JSON.",
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(
      "vibe-check.config.json must contain a JSON object.",
    );
  }

  const userConfig = parsed as UserConfig;

  if (Array.isArray(userConfig.ignoredFolders)) {
    for (const folder of userConfig.ignoredFolders) {
      if (typeof folder === "string" && folder.trim() !== "") {
        config.ignoredFolders.add(folder);
      }
    }
  }

  if (
    typeof userConfig.reportDirectory === "string" &&
    userConfig.reportDirectory.trim() !== ""
  ) {
    config.reportDirectory = path.resolve(
      userConfig.reportDirectory,
    );
  }

  if (isRecord(userConfig.checks)) {
    const checks = userConfig.checks;

    if (typeof checks.hardcodedSecrets === "boolean") {
      config.checks.hardcodedSecrets =
        checks.hardcodedSecrets;
    }

    if (typeof checks.securityTodos === "boolean") {
      config.checks.securityTodos = checks.securityTodos;
    }

    if (typeof checks.wildcardCors === "boolean") {
      config.checks.wildcardCors = checks.wildcardCors;
    }

    if (typeof checks.localhostUrls === "boolean") {
      config.checks.localhostUrls = checks.localhostUrls;
    }
  }

  return config;
}