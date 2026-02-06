// JSONL storage for real-time logging

import fs from 'fs';
import path from 'path';
import type { CapturedRequest, CapturedResponse } from '../types.js';

export interface LogEntry {
  type: 'request' | 'response';
  timestamp: string;
  data: CapturedRequest | CapturedResponse;
}

export class JSONLStorage {
  private filePath: string;
  private writeStream: fs.WriteStream | null = null;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'messages.jsonl');
    this.ensureDirectory(dataDir);
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private getWriteStream(): fs.WriteStream {
    if (!this.writeStream) {
      this.writeStream = fs.createWriteStream(this.filePath, { flags: 'a' });
    }
    return this.writeStream;
  }

  logRequest(request: CapturedRequest): void {
    const entry: LogEntry = {
      type: 'request',
      timestamp: new Date().toISOString(),
      data: request,
    };
    this.writeLine(entry);
  }

  logResponse(response: CapturedResponse): void {
    const entry: LogEntry = {
      type: 'response',
      timestamp: new Date().toISOString(),
      data: response,
    };
    this.writeLine(entry);
  }

  private writeLine(entry: LogEntry): void {
    const stream = this.getWriteStream();
    stream.write(JSON.stringify(entry) + '\n');
  }

  readAll(): LogEntry[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    return lines.map((line) => {
      try {
        return JSON.parse(line) as LogEntry;
      } catch {
        return null;
      }
    }).filter((entry): entry is LogEntry => entry !== null);
  }

  readRequests(): CapturedRequest[] {
    return this.readAll()
      .filter((entry) => entry.type === 'request')
      .map((entry) => entry.data as CapturedRequest);
  }

  readResponses(): CapturedResponse[] {
    return this.readAll()
      .filter((entry) => entry.type === 'response')
      .map((entry) => entry.data as CapturedResponse);
  }

  getRequestResponsePairs(): Array<{ request: CapturedRequest; response: CapturedResponse | null }> {
    const entries = this.readAll();
    const responseMap = new Map<string, CapturedResponse>();

    // Index responses by request_id
    for (const entry of entries) {
      if (entry.type === 'response') {
        const response = entry.data as CapturedResponse;
        responseMap.set(response.request_id, response);
      }
    }

    // Match requests with responses
    return entries
      .filter((entry) => entry.type === 'request')
      .map((entry) => {
        const request = entry.data as CapturedRequest;
        return {
          request,
          response: responseMap.get(request.id) || null,
        };
      });
  }

  clear(): void {
    if (this.writeStream) {
      this.writeStream.close();
      this.writeStream = null;
    }
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  close(): void {
    if (this.writeStream) {
      this.writeStream.close();
      this.writeStream = null;
    }
  }

  getFilePath(): string {
    return this.filePath;
  }
}
