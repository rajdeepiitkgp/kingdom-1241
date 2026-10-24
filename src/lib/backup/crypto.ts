import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Encryption of the content backup (scripts/backup.ts).
 *
 * The weekly backup is stored as a GitHub Actions artifact, and this is a
 * public repository: anyone with a GitHub account can download an artifact.
 * The file is therefore encrypted before it leaves the runner, with a
 * passphrase that only lives in the BACKUP_PASSPHRASE secret. Nothing here is
 * specific to Supabase; it is plain Node crypto so a restore needs no extra
 * tool: AES-256-GCM (confidentiality and tamper detection) with a key derived
 * from the passphrase by scrypt.
 *
 * File layout: magic (8) | version (1) | salt (16) | iv (12) | tag (16) | ciphertext.
 */

const MAGIC = Buffer.from("KD1241BK", "ascii");
const VERSION = 1;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH;

/** scrypt cost: 2^15 iterations, 32 MiB; about 100 ms on a laptop, far too slow for guessing. */
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** A passphrase long enough to make guessing pointless (a 32-byte `openssl rand -hex` value is 64). */
export const MIN_PASSPHRASE_LENGTH = 16;

export function isBackupPassphrase(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= MIN_PASSPHRASE_LENGTH;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase.normalize("NFKC"), salt, 32, SCRYPT);
}

export function encryptBackup(plaintext: string, passphrase: string): Buffer {
  if (!isBackupPassphrase(passphrase)) throw new Error(`The passphrase must have at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, cipher.getAuthTag(), ciphertext]);
}

/** True when the bytes start like a file written by `encryptBackup` (any version). */
export function isBackupFile(data: Buffer): boolean {
  return data.length >= HEADER_LENGTH && data.subarray(0, MAGIC.length).equals(MAGIC);
}

export function decryptBackup(data: Buffer, passphrase: string): string {
  if (!isBackupFile(data)) throw new Error("Not a Kingdom 1241 backup file.");
  const version = data[MAGIC.length];
  if (version !== VERSION) throw new Error(`Backup format version ${version} is not supported by this code (expected ${VERSION}).`);
  let offset = MAGIC.length + 1;
  const salt = data.subarray(offset, (offset += SALT_LENGTH));
  const iv = data.subarray(offset, (offset += IV_LENGTH));
  const tag = data.subarray(offset, (offset += TAG_LENGTH));
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(data.subarray(offset)), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Wrong passphrase, or the backup file is damaged.");
  }
}

/** `kingdom-1241-2026-10-24T1845Z.json.enc`: sortable, no characters a shell or zip minds. */
export function backupFileName(now: Date): string {
  const stamp = now.toISOString().replace(/:(\d\d)\.\d{3}Z$/, "$1Z").replace(/:/g, "");
  return `kingdom-1241-${stamp}.json.enc`;
}
