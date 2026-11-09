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

/** Encrypts any bytes (the images archive) in the backup file format. */
export function encryptBytes(plaintext: Buffer, passphrase: string): Buffer {
  if (!isBackupPassphrase(passphrase)) throw new Error(`The passphrase must have at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, cipher.getAuthTag(), ciphertext]);
}

/** Encrypts the table dump (JSON text). */
export function encryptBackup(plaintext: string, passphrase: string): Buffer {
  return encryptBytes(Buffer.from(plaintext, "utf8"), passphrase);
}

/** True when the bytes start like a file written by `encryptBackup` (any version). */
export function isBackupFile(data: Buffer): boolean {
  return data.length >= HEADER_LENGTH && data.subarray(0, MAGIC.length).equals(MAGIC);
}

/** Decrypts a file written by `encryptBytes` or `encryptBackup`; refuses a wrong passphrase or a changed byte. */
export function decryptBytes(data: Buffer, passphrase: string): Buffer {
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
    return Buffer.concat([decipher.update(data.subarray(offset)), decipher.final()]);
  } catch {
    throw new Error("Wrong passphrase, or the backup file is damaged.");
  }
}

/** The table dump as text. */
export function decryptBackup(data: Buffer, passphrase: string): string {
  return decryptBytes(data, passphrase).toString("utf8");
}

/** `2026-10-24T1845Z`: sortable, no characters a shell or zip minds. */
function stamp(now: Date): string {
  return now.toISOString().replace(/:(\d\d)\.\d{3}Z$/, "$1Z").replace(/:/g, "");
}

/** The table dump: `kingdom-1241-2026-10-24T1845Z.json.enc`. */
export function backupFileName(now: Date): string {
  return `kingdom-1241-${stamp(now)}.json.enc`;
}

/** The content images of the same run, next to the dump: `kingdom-1241-2026-10-24T1845Z.images.enc`. */
export function imageBackupFileName(now: Date): string {
  return `kingdom-1241-${stamp(now)}.images.enc`;
}

/** The images file that belongs to a table dump's path (same stamp), or null when the name doesn't end in `.json.enc`. */
export function imagesFileFor(tablesPath: string): string | null {
  return tablesPath.endsWith(".json.enc") ? `${tablesPath.slice(0, -".json.enc".length)}.images.enc` : null;
}
