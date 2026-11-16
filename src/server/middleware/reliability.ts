import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from '../db/database.ts';
import type { AuthenticatedRequest } from '../auth/auth.ts';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 300;
const clientBuckets = new Map<string, { count: number; resetAt: number }>();
let blockedRequestsCount = 0;

export function apiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  let bucket = clientBuckets.get(clientIp);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    clientBuckets.set(clientIp, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - bucket.count);
  res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS_PER_WINDOW));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    blockedRequestsCount += 1;
    res.status(429).json({
      error: 'API rate limit exceeded. Please retry after the current 60-second window resets.',
    });
    return;
  }

  next();
}

export function getRateLimiterStats() {
  return {
    window_seconds: WINDOW_MS / 1000,
    max_requests_per_window: MAX_REQUESTS_PER_WINDOW,
    tracked_clients: clientBuckets.size,
    blocked_requests: blockedRequestsCount,
  };
}

export function recordAuditLog(params: {
  actorEmail: string;
  actorRole: string;
  action: string;
  resource: string;
  details?: string;
  ipAddress?: string;
}): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO audit_logs (actor_email, actor_role, action, resource, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      params.actorEmail,
      params.actorRole,
      params.action,
      params.resource,
      params.details ?? '',
      params.ipAddress ?? '127.0.0.1'
    );
  } catch {
    // non-fatal audit write
  }
}

export function auditMutationMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    next();
    return;
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      recordAuditLog({
        actorEmail: req.user?.email ?? 'system',
        actorRole: req.user?.role ?? 'Administrator',
        action: req.method,
        resource: req.originalUrl,
        details: `Status ${res.statusCode}`,
        ipAddress: req.ip || '127.0.0.1',
      });
    }
  });

  next();
}

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

export async function createDatabaseBackup(): Promise<{
  filename: string;
  size_kb: number;
  created_at: string;
}> {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `energysync_backup_${stamp}.db`;
  const targetPath = path.join(BACKUP_DIR, filename);

  const db = getDb();
  await db.backup(targetPath);

  const stat = fs.statSync(targetPath);
  return {
    filename,
    size_kb: Number((stat.size / 1024).toFixed(1)),
    created_at: stat.mtime.toISOString(),
  };
}

export function listDatabaseBackups(): Array<{
  filename: string;
  size_kb: number;
  created_at: string;
}> {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((filename) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename));
      return {
        filename,
        size_kb: Number((stat.size / 1024).toFixed(1)),
        created_at: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function verifyBackupSnapshot(filename: string): {
  valid: boolean;
  filename: string;
  size_kb: number;
} {
  const safeName = path.basename(filename);
  const fullPath = path.join(BACKUP_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    throw new Error('Backup snapshot file not found.');
  }
  const stat = fs.statSync(fullPath);
  const header = fs.readFileSync(fullPath, { encoding: 'utf8', flag: 'r' }).slice(0, 15);
  return {
    valid: header.startsWith('SQLite format 3'),
    filename: safeName,
    size_kb: Number((stat.size / 1024).toFixed(1)),
  };
}
