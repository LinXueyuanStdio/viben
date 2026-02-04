import crypto from 'crypto';
import { db, mcpPackages, skillPackages, packageReleases, downloadRecords } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { getStorage, getPackagePath, type EntityType } from '@/lib/storage';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export interface UploadPackageOptions {
  entityType: EntityType;
  entityId: string;
  version: string;
  file: Buffer;
  filename: string;
  releaseNotes?: string;
}

export interface UploadPackageResult {
  releaseId: string;
  downloadUrl: string;
  checksum: string;
  fileSize: number;
}

export async function uploadPackage(
  options: UploadPackageOptions
): Promise<UploadPackageResult> {
  const { entityType, entityId, version, file, filename, releaseNotes } = options;

  // Validate file size
  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Validate package exists and user owns it
  const pkg = await getPackageById(entityType, entityId);
  if (!pkg) {
    throw new Error('Package not found');
  }

  // Check if version already exists
  const existingRelease = await db.query.packageReleases.findFirst({
    where: and(
      eq(packageReleases.entityType, entityType),
      eq(packageReleases.entityId, entityId),
      eq(packageReleases.version, version)
    ),
  });

  if (existingRelease) {
    throw new Error(`Version ${version} already exists`);
  }

  // Calculate checksum
  const checksum = crypto.createHash('sha256').update(file).digest('hex');

  // Upload to storage
  const storage = getStorage();
  const path = getPackagePath({
    entityType,
    entityId,
    version,
    filename,
  });

  const uploadResult = await storage.upload(path, file);

  // Create release record
  const [release] = await db
    .insert(packageReleases)
    .values({
      entityType,
      entityId,
      version,
      releaseNotes: releaseNotes || null,
      downloadUrl: uploadResult.url,
      checksum,
      fileSize: file.length,
    })
    .returning();

  // Update package version
  await updatePackageVersion(entityType, entityId, version);

  return {
    releaseId: release.id,
    downloadUrl: uploadResult.url,
    checksum,
    fileSize: file.length,
  };
}

export interface DownloadPackageOptions {
  entityType: EntityType;
  entityId: string;
  version?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DownloadPackageResult {
  file: Buffer;
  filename: string;
  contentType: string;
  release: {
    id: string;
    version: string;
    checksum: string | null;
    fileSize: number | null;
  };
}

export async function downloadPackage(
  options: DownloadPackageOptions
): Promise<DownloadPackageResult> {
  const { entityType, entityId, version, userId, ipAddress, userAgent } = options;

  // Get release
  let release;
  if (version) {
    release = await db.query.packageReleases.findFirst({
      where: and(
        eq(packageReleases.entityType, entityType),
        eq(packageReleases.entityId, entityId),
        eq(packageReleases.version, version)
      ),
    });
  } else {
    // Get latest release
    release = await db.query.packageReleases.findFirst({
      where: and(
        eq(packageReleases.entityType, entityType),
        eq(packageReleases.entityId, entityId)
      ),
      orderBy: [desc(packageReleases.createdAt)],
    });
  }

  if (!release || !release.downloadUrl) {
    throw new Error('Release not found');
  }

  // Download file
  const storage = getStorage();
  const path = new URL(release.downloadUrl).pathname.slice(1); // Remove leading /
  const file = await storage.download(path);
  const filename = path.split('/').pop() || 'package';

  // Record download
  await db.insert(downloadRecords).values({
    entityType,
    entityId,
    releaseId: release.id,
    userId: userId || null,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  });

  // Increment download count
  await incrementDownloadCount(entityType, entityId);

  return {
    file,
    filename,
    contentType: getContentType(filename),
    release: {
      id: release.id,
      version: release.version,
      checksum: release.checksum,
      fileSize: release.fileSize,
    },
  };
}

export interface Release {
  id: string;
  version: string;
  releaseNotes: string | null;
  checksum: string | null;
  fileSize: number | null;
  createdAt: Date;
}

export async function getReleases(
  entityType: EntityType,
  entityId: string
): Promise<Release[]> {
  const releases = await db.query.packageReleases.findMany({
    where: and(
      eq(packageReleases.entityType, entityType),
      eq(packageReleases.entityId, entityId)
    ),
    orderBy: [desc(packageReleases.createdAt)],
  });

  return releases.map((r) => ({
    id: r.id,
    version: r.version,
    releaseNotes: r.releaseNotes,
    checksum: r.checksum,
    fileSize: r.fileSize,
    createdAt: r.createdAt,
  }));
}

// Helper functions

async function getPackageById(entityType: EntityType, entityId: string) {
  if (entityType === 'mcp') {
    return db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, entityId),
    });
  } else {
    return db.query.skillPackages.findFirst({
      where: eq(skillPackages.id, entityId),
    });
  }
}

async function updatePackageVersion(
  entityType: EntityType,
  entityId: string,
  version: string
): Promise<void> {
  if (entityType === 'mcp') {
    await db
      .update(mcpPackages)
      .set({ version })
      .where(eq(mcpPackages.id, entityId));
  } else {
    await db
      .update(skillPackages)
      .set({ version })
      .where(eq(skillPackages.id, entityId));
  }
}

async function incrementDownloadCount(
  entityType: EntityType,
  entityId: string
): Promise<void> {
  if (entityType === 'mcp') {
    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, entityId),
    });
    if (pkg) {
      await db
        .update(mcpPackages)
        .set({ downloadsCount: pkg.downloadsCount + 1 })
        .where(eq(mcpPackages.id, entityId));
    }
  } else {
    const pkg = await db.query.skillPackages.findFirst({
      where: eq(skillPackages.id, entityId),
    });
    if (pkg) {
      await db
        .update(skillPackages)
        .set({ downloadsCount: pkg.downloadsCount + 1 })
        .where(eq(skillPackages.id, entityId));
    }
  }
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'zip':
      return 'application/zip';
    case 'gz':
    case 'tgz':
      return 'application/gzip';
    case 'tar':
      return 'application/x-tar';
    default:
      return 'application/octet-stream';
  }
}
