/**
 * SQLite database wrapper for summaries using sql.js (serverless-compatible).
 * Ported from backend/database.py
 */

import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";
import type { Summary } from "./types.js";
import logger from "./logger.js";

// In-memory database (sql.js)
let db: SqlJsDatabase | null = null;
let dbPath = "";

async function initDatabase(): Promise<void> {
  if (db !== null) {
    return;
  }

  dbPath = process.env.SQLITE_DB_PATH || "/tmp/summaries.db";

  try {
    const SQL = await initSqlJs();

    // Load existing database if file exists
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      logger.info(`SQLite database loaded from ${dbPath}`);
    } else {
      db = new SQL.Database();

      // Create summaries table
      db.run(`
        CREATE TABLE IF NOT EXISTS summaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          summary TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      logger.info(`SQLite database created at ${dbPath}`);
    }
  } catch (error) {
    const err = error as Error;
    logger.error(
      { error: err.message },
      "SQLite database initialization failed",
    );
    throw err;
  }
}

/**
 * Save database to file.
 */
function saveDatabase(): void {
  if (db === null) {
    return;
  }

  try {
    const data = db.export();
    const buffer = Buffer.from(data);

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Save database error");
  }
}

/**
 * Save a summary to database.
 * @param filename - Document filename
 * @param summary - Summary text
 */
export async function saveSummary(
  filename: string,
  summary: string,
): Promise<void> {
  await initDatabase();

  try {
    db!.run("INSERT INTO summaries (filename, summary) VALUES (?, ?)", [
      filename,
      summary,
    ]);

    saveDatabase();

    logger.info({ filename }, "Summary saved to database");
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, filename }, "Save summary error");
    throw err;
  }
}

/**
 * Get all summaries from database.
 * @returns Array of summaries
 */
export async function getAllSummaries(): Promise<Summary[]> {
  await initDatabase();

  try {
    const results = db!.exec(`
      SELECT id, filename, summary, created_at
      FROM summaries
      ORDER BY created_at DESC
    `);

    if (!results.length || !results[0].values.length) {
      return [];
    }

    const rows = results[0].values;

    return rows.map((row: unknown[]) => ({
      id: row[0] as number,
      filename: row[1] as string,
      summary: row[2] as string,
      created_at: row[3] as string,
    }));
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Get all summaries error");
    throw err;
  }
}

/**
 * Get a summary by filename.
 * @param filename - Document filename
 * @returns Summary or null
 */
export async function getSummaryByFilename(
  filename: string,
): Promise<Summary | null> {
  await initDatabase();

  try {
    const results = db!.exec(
      `
      SELECT id, filename, summary, created_at
      FROM summaries
      WHERE filename = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
      [filename],
    );

    if (!results.length || !results[0].values.length) {
      return null;
    }

    const row = results[0].values[0];

    return {
      id: row[0] as number,
      filename: row[1] as string,
      summary: row[2] as string,
      created_at: row[3] as string,
    };
  } catch (error) {
    const err = error as Error;
    logger.error(
      { error: err.message, filename },
      "Get summary by filename error",
    );
    throw err;
  }
}

/**
 * Delete a summary by filename.
 * @param filename - Document filename
 */
export async function deleteSummary(filename: string): Promise<number> {
  await initDatabase();

  try {
    db!.run("DELETE FROM summaries WHERE filename = ?", [filename]);

    saveDatabase();

    logger.info({ filename }, "Summary deleted from database");

    return 1;
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, filename }, "Delete summary error");
    throw err;
  }
}

/**
 * Close database connection.
 */
export function closeDatabase(): void {
  if (db !== null) {
    db.close();
    db = null;
    logger.info("Database connection closed");
  }
}

export default db;
