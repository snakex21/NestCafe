// ============================================================
// AES-256-GCM encrypted secure storage for API keys.
// Uses machine-derived keys (PBKDF2 from platform + home dir).
// Less secure than OS Keychain but avoids permission prompts.
// ============================================================

import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// ---- Types ----

export interface SecureStorageOptions {
  storagePath: string;
  appId: string;
  fileName?: string;
}

interface SecureStorageSchema {
  values: Record<string, string>;
  salt?: string;
}

// ---- SecureStorage class ----

export class SecureStorage {
  private storagePath: string;
  private appId: string;
  private filePath: string;
  private derivedKey: Buffer | null = null;
  private data: SecureStorageSchema | null = null;

  constructor(options: SecureStorageOptions) {
    this.storagePath = options.storagePath;
    this.appId = options.appId;
    this.filePath = path.join(this.storagePath, options.fileName ?? 'secure-storage.json');
  }

  // ---- Public API ----

  /** Store a generic key-value pair (encrypted). */
  set(key: string, value: string): void {
    const data = this.loadData();
    data.values[key] = this.encrypt(value);
    this.saveData();
  }

  /** Retrieve and decrypt a value by key. */
  get(key: string): string | null {
    const data = this.loadData();
    const encrypted = data.values[key];
    if (!encrypted) {
      return null;
    }
    return this.decrypt(encrypted);
  }

  /** Delete a key. Returns false if key didn't exist. */
  delete(key: string): boolean {
    const data = this.loadData();
    if (!(key in data.values)) {
      return false;
    }
    delete data.values[key];
    this.saveData();
    return true;
  }

  /** Check if a key exists. */
  has(key: string): boolean {
    const data = this.loadData();
    return key in data.values;
  }

  storeApiKey(provider: string, apiKey: string): void {
    this.set(`apiKey:${provider}`, apiKey);
  }

  getApiKey(provider: string): string | null {
    return this.get(`apiKey:${provider}`);
  }

  deleteApiKey(provider: string): boolean {
    return this.delete(`apiKey:${provider}`);
  }

  storeBedrockCredentials(credentials: string): void {
    this.storeApiKey('bedrock', credentials);
  }

  getBedrockCredentials(): Record<string, string> | null {
    const stored = this.getApiKey('bedrock');
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored) as Record<string, string>;
    } catch {
      return null;
    }
  }

  clearAll(): void {
    this.data = { values: {} };
    this.derivedKey = null;
    this.saveData();
  }

  // ---- Private: data I/O ----

  private loadData(): SecureStorageSchema {
    if (this.data) {
      return this.data;
    }
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(content) as SecureStorageSchema;
      } else {
        this.data = { values: {} };
      }
    } catch {
      this.data = { values: {} };
    }
    return this.data;
  }

  private saveData(): void {
    if (!this.data) {
      return;
    }
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    const content = JSON.stringify(this.data, null, 2);

    try {
      fs.writeFileSync(tempPath, content, { mode: 0o600 });
      fs.renameSync(tempPath, this.filePath);
    } catch (error) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // cleanup failure is non-fatal
      }
      throw error;
    }
  }

  // ---- Private: encryption ----

  private getSalt(): Buffer {
    const data = this.loadData();
    if (!data.salt) {
      const salt = crypto.randomBytes(32);
      data.salt = salt.toString('base64');
      this.saveData();
    }
    return Buffer.from(data.salt!, 'base64');
  }

  private getDerivedKey(): Buffer {
    if (this.derivedKey) {
      return this.derivedKey;
    }
    const machineData = [os.platform(), os.homedir(), os.userInfo().username, this.appId].join(':');
    const salt = this.getSalt();
    this.derivedKey = crypto.pbkdf2Sync(machineData, salt, 100_000, 32, 'sha256');
    return this.derivedKey;
  }

  private encrypt(value: string): string {
    const key = this.getDerivedKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  private decrypt(encryptedData: string): string | null {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        return null;
      }
      const [ivBase64, authTagBase64, ciphertext] = parts as [string, string, string];
      const key = this.getDerivedKey();
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return null;
    }
  }
}
