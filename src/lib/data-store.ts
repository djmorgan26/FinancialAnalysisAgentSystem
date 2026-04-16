import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type {
  FinancialData,
  AnalysisResult,
  UserProfile,
  Snapshot,
} from "./types";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const NORMALIZED_DIR = path.join(DATA_DIR, "normalized");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");
const CONFIG_DIR = path.join(PROJECT_ROOT, "config");

const FINANCIAL_DATA_PATH = path.join(NORMALIZED_DIR, "financial-data.json");
const ANALYSIS_PATH = path.join(NORMALIZED_DIR, "analysis.json");
const USER_PROFILE_PATH = path.join(CONFIG_DIR, "user-profile.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure a directory exists, creating it (and parents) if necessary. */
async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Safely read and parse a JSON file. Returns `null` when the file is missing. */
async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/** Write a JSON file atomically (write to tmp, then rename). */
async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, filePath);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

// ---------------------------------------------------------------------------
// Default data factories
// ---------------------------------------------------------------------------

function defaultFinancialData(): FinancialData {
  return {
    lastUpdated: new Date().toISOString(),
    accounts: [],
    transactions: [],
    holdings: [],
  };
}

function defaultUserProfile(): UserProfile {
  return {
    name: "",
    age: 0,
    annualIncome: 0,
    occupation: "",
    fixedExpenses: [],
    investmentPreferences: {
      sectorBias: [],
      riskTolerance: "moderate",
      timeHorizon: "long",
    },
    accounts: [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the consolidated financial data from disk.
 * Returns an empty structure when no data file exists yet.
 */
export async function loadFinancialData(): Promise<FinancialData> {
  const data = await readJson<FinancialData>(FINANCIAL_DATA_PATH);
  return data ?? defaultFinancialData();
}

/**
 * Persist the consolidated financial data to disk.
 */
export async function saveFinancialData(data: FinancialData): Promise<void> {
  data.lastUpdated = new Date().toISOString();
  await writeJson(FINANCIAL_DATA_PATH, data);
}

/**
 * Load the most recent analysis result.
 * Returns `null` when no analysis has been run yet.
 */
export async function loadAnalysis(): Promise<AnalysisResult | null> {
  return readJson<AnalysisResult>(ANALYSIS_PATH);
}

/**
 * Persist an analysis result to disk.
 */
export async function saveAnalysis(result: AnalysisResult): Promise<void> {
  await writeJson(ANALYSIS_PATH, result);
}

/**
 * Load the user profile from the config directory.
 * Returns a blank profile when the config file does not exist.
 */
export async function loadUserProfile(): Promise<UserProfile> {
  const profile = await readJson<UserProfile>(USER_PROFILE_PATH);
  return profile ?? defaultUserProfile();
}

/**
 * Create a timestamped snapshot derived from an analysis result and persist it
 * to the snapshots directory. Returns the created snapshot.
 */
export async function createSnapshot(
  analysis: AnalysisResult,
): Promise<Snapshot> {
  await ensureDir(SNAPSHOTS_DIR);

  const snapshot: Snapshot = {
    id: uuidv4(),
    date: analysis.generatedAt,
    netWorth: analysis.netWorth,
    totalAssets: analysis.totalAssets,
    totalLiabilities: analysis.totalLiabilities,
    savingsRate: analysis.savingsRate,
    accountBalances: analysis.accounts.map((a) => ({
      accountId: a.id,
      balance: a.balance,
    })),
  };

  const filename = `snapshot-${snapshot.date.replace(/[:.]/g, "-")}.json`;
  await writeJson(path.join(SNAPSHOTS_DIR, filename), snapshot);

  return snapshot;
}

/**
 * Load every historical snapshot, sorted chronologically (oldest first).
 */
export async function loadSnapshots(): Promise<Snapshot[]> {
  await ensureDir(SNAPSHOTS_DIR);

  let entries: string[];
  try {
    entries = await fs.readdir(SNAPSHOTS_DIR);
  } catch {
    return [];
  }

  const jsonFiles = entries.filter((f) => f.endsWith(".json"));

  const snapshots = await Promise.all(
    jsonFiles.map(async (file) => {
      const snapshot = await readJson<Snapshot>(
        path.join(SNAPSHOTS_DIR, file),
      );
      return snapshot;
    }),
  );

  return snapshots
    .filter((s): s is Snapshot => s !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
