import { describe, expect, it } from "vitest";
import { backupFileName, decryptBackup, encryptBackup, isBackupFile, isBackupPassphrase, MIN_PASSPHRASE_LENGTH } from "@/lib/backup/crypto";

const PASSPHRASE = "correct horse battery staple 1241";

describe("backup encryption", () => {
  it("round-trips text, including non-Latin content", () => {
    const text = JSON.stringify({ title: { en: "Rules", ar: "القواعد", ko: "규칙", ja: "ルール" }, n: 1 });
    const file = encryptBackup(text, PASSPHRASE);
    expect(isBackupFile(file)).toBe(true);
    expect(decryptBackup(file, PASSPHRASE)).toBe(text);
  });

  it("never writes the plaintext or the same bytes twice", () => {
    const text = "the battle-plan password is hunter2";
    const a = encryptBackup(text, PASSPHRASE);
    const b = encryptBackup(text, PASSPHRASE);
    expect(a.includes(Buffer.from("hunter2"))).toBe(false);
    expect(a.includes(Buffer.from("password"))).toBe(false);
    expect(a.equals(b)).toBe(false); // fresh salt and nonce every time
  });

  it("rejects a wrong passphrase and a tampered file", () => {
    const file = encryptBackup("secret", PASSPHRASE);
    expect(() => decryptBackup(file, PASSPHRASE + "x")).toThrow(/wrong passphrase/i);
    const tampered = Buffer.from(file);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptBackup(tampered, PASSPHRASE)).toThrow(/wrong passphrase|damaged/i);
  });

  it("rejects files that are not backups and unknown versions", () => {
    expect(() => decryptBackup(Buffer.from("{}"), PASSPHRASE)).toThrow(/not a .* backup/i);
    const file = encryptBackup("x", PASSPHRASE);
    const future = Buffer.from(file);
    future[8] = 9;
    expect(() => decryptBackup(future, PASSPHRASE)).toThrow(/version 9/);
  });

  it("insists on a passphrase of some length", () => {
    expect(isBackupPassphrase("short")).toBe(false);
    expect(isBackupPassphrase(" ".repeat(40))).toBe(false);
    expect(isBackupPassphrase("a".repeat(MIN_PASSPHRASE_LENGTH))).toBe(true);
    expect(isBackupPassphrase(undefined)).toBe(false);
    expect(() => encryptBackup("x", "short")).toThrow(/at least/);
  });

  it("names files so they sort by time and need no quoting", () => {
    const name = backupFileName(new Date("2026-10-24T18:45:07.123Z"));
    expect(name).toBe("kingdom-1241-2026-10-24T184507Z.json.enc");
    expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});
