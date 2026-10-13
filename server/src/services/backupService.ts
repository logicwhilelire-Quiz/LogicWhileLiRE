import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
const archiver = require('archiver');
import { supabase } from '../db/supabase';

// ============================================================================
// CONFIGURATION & CREDENTIAL SANITIZATION
// ============================================================================
export function getBackupDirectory(): string {
  const custom = process.env.BACKUP_DIR;
  if (custom) {
    const resolved = path.resolve(custom);
    try {
      if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
      fs.accessSync(resolved, fs.constants.W_OK);
      return resolved;
    } catch (err) {
      console.warn(`[Backup] Custom directory '${custom}' not writable, falling back to temporary path.`);
    }
  }
  const fallback = process.platform === 'win32'
    ? path.resolve(process.env.TEMP || 'C:\\Windows\\Temp', 'logicwhilelire-backups')
    : '/tmp/logicwhilelire-backups';
  try {
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  } catch {}
  return fallback;
}

export const BACKUP_DIR = getBackupDirectory();

const CREDENTIAL_BLACKLIST = new Set([
  'password',
  'password_hash',
  'temp_password',
  'session_token',
  'totp_secret',
  'auth_token',
  'jwt_secret',
  'jwt_token',
  'secret',
  'api_key',
  'access_token',
  'refresh_token',
  'token',
  'admin_password_hash',
]);

/**
 * Recursively strip all credentials and sensitive tokens from record objects.
 * Guarantees that no passwords, hashes, or session tokens enter backup files.
 */
export function sanitizeRecord(record: any): any {
  if (record === null || record === undefined) return record;
  if (Array.isArray(record)) {
    return record.map(sanitizeRecord);
  }
  if (typeof record === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      if (CREDENTIAL_BLACKLIST.has(key.toLowerCase())) {
        continue; // OMIT CREDENTIAL FIELD COMPLETELY
      }
      if (typeof value === 'object' && value !== null) {
        clean[key] = sanitizeRecord(value);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }
  return record;
}

/**
 * Standard RFC-4180 compliant CSV serializer with proper cell quoting
 */
export function convertToCsv(records: any[]): string {
  if (!records || records.length === 0) return '';
  const headers = Array.from(new Set(records.flatMap((r) => Object.keys(r))));

  const escapeCell = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      val = JSON.stringify(val);
    }
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = records.map((record) =>
    headers.map((h) => escapeCell(record[h])).join(',')
  );
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Accurately count CSV data rows, respecting newlines within quotes
 */
export function countCsvRecords(csvString: string): number {
  if (!csvString || csvString.trim().length === 0) return 0;
  let inQuotes = false;
  let lineBreaks = 0;
  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];
    if (char === '"') {
      if (inQuotes && csvString[i + 1] === '"') {
        i++; // skip escaped quote ""
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' && !inQuotes) {
      lineBreaks++;
    }
  }
  if (!csvString.endsWith('\n')) {
    lineBreaks++;
  }
  return Math.max(0, lineBreaks - 1); // exclude header row
}

/**
 * Calculate SHA-256 hash of a file
 */
export function calculateFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ============================================================================
// RETENTION POLICY: PURGE BACKUPS OLDER THAN 30 DAYS
// ============================================================================
export function pruneOldBackups(retentionDays: number = 30): { purged: string[]; kept: string[] } {
  const purged: string[] = [];
  const kept: string[] = [];

  if (!fs.existsSync(BACKUP_DIR)) {
    return { purged, kept };
  }

  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('backup_')) {
      const fullPath = path.join(BACKUP_DIR, entry.name);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.mtimeMs < cutoffTime) {
          if (entry.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
          purged.push(entry.name);
        } else {
          kept.push(entry.name);
        }
      } catch (err) {
        console.warn(`[Backup Retention] Error checking ${entry.name}:`, err);
      }
    }
  }

  return { purged, kept };
}

// ============================================================================
// MAIN BACKUP EXECUTION ENGINE
// ============================================================================
export interface BackupResult {
  success: boolean;
  backupId: string;
  backupFolderPath: string;
  zipFilePath?: string;
  timestamp: string;
  manifest: {
    version: string;
    backupId: string;
    timestamp: string;
    tables: Record<
      string,
      {
        sourceRows: number;
        jsonRows: number;
        csvRows: number;
        csvFile: string;
        jsonFile: string;
        sha256Csv: string;
        sha256Json: string;
        integrityPass: boolean;
      }
    >;
    batchStudentFilesCount: number;
    examResultFilesCount: number;
    totalRecords: number;
    integrityStatus: 'PASS' | 'FAIL';
    retentionPurgedCount: number;
  };
  durationMs: number;
}

export async function executeSystemBackup(options: {
  trigger?: 'cli' | 'admin' | 'cron';
  adminId?: string;
  createZip?: boolean;
}): Promise<BackupResult> {
  const startTime = Date.now();
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupId = `backup_${timestampStr}`;
  const backupFolderPath = path.join(BACKUP_DIR, backupId);

  // Subdirectories
  const csvDir = path.join(backupFolderPath, 'csv');
  const jsonDir = path.join(backupFolderPath, 'json');
  const batchStudentsDir = path.join(backupFolderPath, 'batch_wise_students');
  const examResultsDir = path.join(backupFolderPath, 'exam_results');

  fs.mkdirSync(csvDir, { recursive: true });
  fs.mkdirSync(jsonDir, { recursive: true });
  fs.mkdirSync(batchStudentsDir, { recursive: true });
  fs.mkdirSync(examResultsDir, { recursive: true });

  // 1. Fetch all key tables from database
  const [
    studentsRaw,
    candidatesRaw,
    staffRaw,
    collegesRaw,
    sectionsRaw,
    batchesRaw,
    cohortsRaw,
    academicYearsRaw,
    examsRaw,
    examCodesRaw,
    questionsRaw,
    questionsEcRaw,
    attemptsRaw,
    sessionsRaw,
    resultsRaw,
    auditLogsRaw,
  ] = await Promise.all([
    supabase.from('students').select('*').then((r) => r.data || []),
    supabase.from('participants').select('*').then((r) => (r.data && r.data.length ? r.data : supabase.from('candidates').select('*').then((c) => c.data || []))),
    supabase.from('staff').select('*').then((r) => r.data || []),
    supabase.from('colleges').select('*').then((r) => r.data || []),
    supabase.from('sections').select('*').then((r) => r.data || []),
    supabase.from('batches').select('*').then((r) => r.data || []),
    supabase.from('cohorts').select('*').then((r) => r.data || []),
    supabase.from('academic_years').select('*').then((r) => r.data || []),
    supabase.from('exams').select('*').then((r) => r.data || []),
    supabase.from('exam_codes').select('*').then((r) => r.data || []),
    supabase.from('questions').select('*').then((r) => r.data || []),
    supabase.from('questions_ec').select('*').then((r) => r.data || []),
    supabase.from('exam_code_attempts').select('*').then((r) => r.data || []),
    supabase.from('exam_sessions').select('*').then((r) => (r.data && r.data.length ? r.data : supabase.from('sessions').select('*').then((s) => s.data || []))),
    supabase.from('results').select('*').then((r) => r.data || []),
    supabase.from('audit_log').select('*').limit(2000).then((r) => r.data || []),
  ]);

  // Combine related entity sets
  const combinedStudents = [...studentsRaw, ...candidatesRaw];
  const combinedExams = [...examsRaw, ...examCodesRaw];
  const combinedQuestions = [...questionsRaw, ...questionsEcRaw];
  const combinedAttempts = [...attemptsRaw, ...sessionsRaw];

  const tableDataMap: Record<string, any[]> = {
    students: combinedStudents,
    staff: staffRaw,
    colleges: collegesRaw,
    sections: sectionsRaw,
    batches: batchesRaw,
    cohorts: cohortsRaw,
    academic_years: academicYearsRaw,
    exams: combinedExams,
    questions: combinedQuestions,
    attempts: combinedAttempts,
    results: resultsRaw,
    audit_logs: auditLogsRaw,
  };

  const manifestTables: BackupResult['manifest']['tables'] = {};
  let totalRecords = 0;
  let allIntegrityPass = true;

  // 2. Export each table to CSV and JSON with credential sanitization and integrity checks
  for (const [tableName, rawRecords] of Object.entries(tableDataMap)) {
    const sourceRows = rawRecords.length;
    totalRecords += sourceRows;

    // Strict credential sanitization
    const sanitized = sanitizeRecord(rawRecords);

    // Write JSON
    const jsonFileName = `${tableName}.json`;
    const jsonFilePath = path.join(jsonDir, jsonFileName);
    fs.writeFileSync(jsonFilePath, JSON.stringify(sanitized, null, 2), 'utf8');
    const sha256Json = calculateFileHash(jsonFilePath);

    // Verify written JSON integrity
    const parsedBack = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    const jsonRows = Array.isArray(parsedBack) ? parsedBack.length : 0;

    // Write CSV
    const csvFileName = `${tableName}.csv`;
    const csvFilePath = path.join(csvDir, csvFileName);
    const csvContent = convertToCsv(sanitized);
    fs.writeFileSync(csvFilePath, csvContent, 'utf8');
    const sha256Csv = calculateFileHash(csvFilePath);

    // Verify written CSV integrity (handles multiline cells in questions)
    const csvRows = countCsvRecords(csvContent);

    const integrityPass = jsonRows === sourceRows && (sourceRows === 0 || csvRows === sourceRows);
    if (!integrityPass) {
      allIntegrityPass = false;
    }

    manifestTables[tableName] = {
      sourceRows,
      jsonRows,
      csvRows,
      csvFile: `csv/${csvFileName}`,
      jsonFile: `json/${jsonFileName}`,
      sha256Csv,
      sha256Json,
      integrityPass,
    };
  }

  // 3. Generate Batch-wise Student Lists
  let batchStudentFilesCount = 0;
  const batchMap = new Map<string, any[]>();
  for (const s of sanitizeRecord(combinedStudents)) {
    const batchKey = s.batch_name || s.batch_id || s.section_name || s.section || s.college_id || 'unassigned_batch';
    const safeKey = String(batchKey).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!batchMap.has(safeKey)) batchMap.set(safeKey, []);
    batchMap.get(safeKey)!.push({
      roll_number: s.roll_number || s.roll_no || s.hall_ticket_no || s.id,
      full_name: s.full_name || s.name || s.candidate_name,
      email: s.email,
      contact_number: s.contact_number || s.mobile || s.phone,
      college: s.college_name || s.college_id,
      cohort: s.cohort_name || s.year_of_passing || s.cohort_id,
      section: s.section_name || s.section,
      batch: s.batch_name || s.batch_id,
      status: s.is_active !== undefined ? (s.is_active ? 'active' : 'inactive') : 'enrolled',
    });
  }

  for (const [batchName, studentsInBatch] of batchMap.entries()) {
    const batchCsv = convertToCsv(studentsInBatch);
    const batchFilePath = path.join(batchStudentsDir, `batch_${batchName}.csv`);
    fs.writeFileSync(batchFilePath, batchCsv, 'utf8');
    batchStudentFilesCount++;
  }

  // 4. Generate Result Sheets Per Exam
  let examResultFilesCount = 0;
  const examResultsMap = new Map<string, any[]>();
  for (const att of sanitizeRecord(combinedAttempts)) {
    const examCode = att.exam_code || att.exam_id || 'GENERAL_EXAM';
    const safeExamCode = String(examCode).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!examResultsMap.has(safeExamCode)) examResultsMap.set(safeExamCode, []);
    examResultsMap.get(safeExamCode)!.push({
      exam_code: att.exam_code || att.exam_id,
      hall_ticket_no: att.hall_ticket_no || att.hall_ticket || att.student_id,
      student_name: att.student_name || att.candidate_name || att.name,
      score: att.score ?? 0,
      max_score: att.max_score ?? 100,
      percentage:
        att.max_score > 0
          ? Math.round((Number(att.score || 0) / Number(att.max_score)) * 100)
          : 0,
      rank: att.rank ?? null,
      correct_count: att.correct_count ?? 0,
      wrong_count: att.wrong_count ?? 0,
      time_taken_seconds: att.time_taken_seconds ?? 0,
      status: att.status || 'completed',
    });
  }

  for (const [examCode, resultsInExam] of examResultsMap.entries()) {
    const examCsv = convertToCsv(resultsInExam);
    const examFilePath = path.join(examResultsDir, `results_${examCode}.csv`);
    fs.writeFileSync(examFilePath, examCsv, 'utf8');
    examResultFilesCount++;
  }

  // 5. Apply 30-Day Retention Policy
  const { purged } = pruneOldBackups(30);

  const durationMs = Date.now() - startTime;
  const integrityStatus = allIntegrityPass ? 'PASS' : 'FAIL';

  // 6. Write Manifest & Summary Logs
  const manifest: BackupResult['manifest'] = {
    version: '4.0.0',
    backupId,
    timestamp: new Date().toISOString(),
    tables: manifestTables,
    batchStudentFilesCount,
    examResultFilesCount,
    totalRecords,
    integrityStatus,
    retentionPurgedCount: purged.length,
  };

  const manifestPath = path.join(backupFolderPath, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const summaryLog = `
================================================================================
LOGICWHILELIRE SYSTEM BACKUP SUMMARY
================================================================================
Backup ID:         ${backupId}
Timestamp:         ${manifest.timestamp}
Trigger:           ${options.trigger || 'cli'}
Operator:          ${options.adminId || 'system'}
Integrity Status:  ${integrityStatus}
Execution Time:    ${durationMs}ms
Backup Location:   ${backupFolderPath}
--------------------------------------------------------------------------------
TABLES EXPORTED:
${Object.entries(manifestTables)
  .map(([t, info]) => `  • ${t.padEnd(16)}: ${String(info.sourceRows).padStart(6)} rows | Integrity: ${info.integrityPass ? 'PASS' : 'FAIL'}`)
  .join('\n')}
--------------------------------------------------------------------------------
BATCH-WISE STUDENT LISTS: ${batchStudentFilesCount} files created
EXAM-WISE RESULT SHEETS:  ${examResultFilesCount} files created
TOTAL DATABASE RECORDS:   ${totalRecords}
RETENTION PRUNED (>30D):  ${purged.length} archives removed
================================================================================
`.trim();

  fs.writeFileSync(path.join(backupFolderPath, 'backup_summary.log'), summaryLog, 'utf8');

  // Append to master backup.log in BACKUP_DIR
  const masterLogPath = path.join(BACKUP_DIR, 'backup.log');
  const masterEntry = `[${manifest.timestamp}] BACKUP_ID=${backupId} RECORDS=${totalRecords} STATUS=${integrityStatus} DURATION=${durationMs}ms PURGED=${purged.length}\n`;
  fs.appendFileSync(masterLogPath, masterEntry, 'utf8');

  // 7. Optionally generate zip archive
  let zipFilePath: string | undefined;
  if (options.createZip !== false) {
    zipFilePath = await createBackupZip(backupFolderPath);
  }

  return {
    success: true,
    backupId,
    backupFolderPath,
    zipFilePath,
    timestamp: manifest.timestamp,
    manifest,
    durationMs,
  };
}

/**
 * Creates a standard ZIP archive of a backup folder
 */
export async function createBackupZip(backupFolderPath: string): Promise<string> {
  const zipPath = `${backupFolderPath}.zip`;
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    let archive: any;
    if (typeof archiver === 'function') {
      archive = archiver('zip', { zlib: { level: 9 } });
    } else if (archiver?.ZipArchive) {
      archive = new archiver.ZipArchive({ zlib: { level: 9 } });
    } else if (archiver?.default && typeof archiver.default === 'function') {
      archive = archiver.default('zip', { zlib: { level: 9 } });
    } else {
      archive = new (archiver.default || archiver)('zip', { zlib: { level: 9 } });
    }

    output.on('close', () => resolve(zipPath));
    archive.on('error', (err: any) => reject(err));

    archive.pipe(output);
    archive.directory(backupFolderPath, false);
    archive.finalize();
  });
}
