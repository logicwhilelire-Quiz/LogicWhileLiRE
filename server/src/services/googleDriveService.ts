import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ============================================================================
// GOOGLE DRIVE SERVICE ACCOUNT BACKUP INTEGRATION
// ============================================================================
// All service account credentials reside STRICTLY in server environment variables:
// - GOOGLE_SERVICE_ACCOUNT_EMAIL
// - GOOGLE_PRIVATE_KEY
// - GOOGLE_DRIVE_FOLDER_ID
// ============================================================================

export interface GoogleDriveConfig {
  serviceAccountEmail: string | null;
  privateKey: string | null;
  rootFolderId: string | null;
}

export function getGoogleDriveConfig(): GoogleDriveConfig {
  const serviceAccountEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    null;

  let rawKey = process.env.GOOGLE_PRIVATE_KEY || null;
  if (rawKey) {
    // Correctly restore newlines if encoded as literal \n in environment variables
    rawKey = rawKey.replace(/\\n/g, '\n');
  }

  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;

  return {
    serviceAccountEmail,
    privateKey: rawKey,
    rootFolderId,
  };
}

export function isGoogleDriveConfigured(): boolean {
  const cfg = getGoogleDriveConfig();
  return Boolean(cfg.serviceAccountEmail && cfg.privateKey);
}

export function getGoogleDrivePublicStatus(): {
  configured: boolean;
  service_account_email: string | null;
  root_folder_id: string | null;
} {
  const cfg = getGoogleDriveConfig();
  return {
    configured: Boolean(cfg.serviceAccountEmail && cfg.privateKey),
    service_account_email: cfg.serviceAccountEmail ? maskEmail(cfg.serviceAccountEmail) : null,
    root_folder_id: cfg.rootFolderId ? `${cfg.rootFolderId.slice(0, 6)}...` : null,
  };
}

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length < 2) return email;
  const user = parts[0];
  const maskedUser = user.length > 3 ? `${user.slice(0, 3)}***` : `${user}***`;
  return `${maskedUser}@${parts[1]}`;
}

/**
 * Generates an OAuth2 access token for Google Drive API using RS256 signed JWT
 */
export async function getGoogleServiceAccountToken(): Promise<string> {
  const cfg = getGoogleDriveConfig();
  if (!cfg.serviceAccountEmail || !cfg.privateKey) {
    throw new Error('[GoogleDrive] Service account credentials are not configured in environment.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: cfg.serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64Url = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const unsignedToken = `${base64Url(header)}.${base64Url(claimSet)}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  const signature = signer.sign(cfg.privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwtAssertion = `${unsignedToken}.${signature}`;

  // Exchange JWT for bearer token
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwtAssertion,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[GoogleDrive] Token exchange failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Creates a folder in Google Drive
 */
export async function createDriveFolder(
  token: string,
  name: string,
  parentId?: string | null
): Promise<{ id: string; name: string }> {
  const metadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[GoogleDrive] Failed to create folder "${name}": ${err}`);
  }

  return (await res.json()) as { id: string; name: string };
}

/**
 * Uploads a file (Buffer or stream) to Google Drive via multipart upload
 */
export async function uploadFileToDrive(
  token: string,
  fileName: string,
  mimeType: string,
  content: Buffer,
  parentId?: string | null
): Promise<{ id: string; name: string }> {
  const metadata: any = {
    name: fileName,
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const boundary = `-------LogicWhileLiREBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody = Buffer.concat([
    Buffer.from(
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata
      )}\r\n`
    ),
    Buffer.from(
      `${delimiter}Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`
    ),
    Buffer.from(content.toString('base64')),
    Buffer.from(closeDelimiter),
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(multipartBody.length),
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[GoogleDrive] Failed to upload file "${fileName}": ${err}`);
  }

  return (await res.json()) as { id: string; name: string };
}

/**
 * Recursively uploads a local folder tree into Google Drive
 */
export async function uploadDirectoryToDrive(
  token: string,
  localDirPath: string,
  parentDriveFolderId: string
): Promise<number> {
  let count = 0;
  const entries = fs.readdirSync(localDirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(localDirPath, entry.name);
    if (entry.isDirectory()) {
      const folder = await createDriveFolder(token, entry.name, parentDriveFolderId);
      count += await uploadDirectoryToDrive(token, fullPath, folder.id);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      let mimeType = 'application/octet-stream';
      if (ext === '.xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else if (ext === '.csv') mimeType = 'text/csv';
      else if (ext === '.pdf') mimeType = 'application/pdf';
      else if (ext === '.json') mimeType = 'application/json';
      else if (ext === '.zip') mimeType = 'application/zip';
      else if (ext === '.log' || ext === '.txt') mimeType = 'text/plain';

      const fileBuffer = fs.readFileSync(fullPath);
      await uploadFileToDrive(token, entry.name, mimeType, fileBuffer, parentDriveFolderId);
      count++;
    }
  }

  return count;
}
