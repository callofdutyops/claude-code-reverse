// Express proxy server for intercepting Claude API requests

import express, { Request, Response } from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import zlib from 'zlib';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer, WebSocket } from 'ws';
import type { CapturedRequest, CapturedResponse, ContentBlock } from '../types.js';
import { SSEParser } from './streaming.js';
import { JSONLStorage } from '../storage/jsonl.js';

const ANTHROPIC_API_HOST = 'api.anthropic.com';

export interface ProxyServerOptions {
  port: number;
  dataDir: string;
  verbose?: boolean;
}

export class ProxyServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private storage: JSONLStorage;
  private options: ProxyServerOptions;
  private wsClients: Set<WebSocket> = new Set();

  constructor(options: ProxyServerOptions) {
    this.options = options;
    this.storage = new JSONLStorage(options.dataDir);
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    // Don't parse body as JSON - we need raw body for forwarding
    this.app.use(express.raw({ type: '*/*', limit: '50mb' }));
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API endpoint for fetching captured data
    this.app.get('/api/captures', (_req: Request, res: Response) => {
      const pairs = this.storage.getRequestResponsePairs();
      res.json(pairs);
    });

    // Clear captured data
    this.app.delete('/api/captures', (_req: Request, res: Response) => {
      this.storage.clear();
      res.json({ status: 'cleared' });
    });

    // Proxy all other requests to Anthropic API
    this.app.all('*', this.handleProxyRequest.bind(this));
  }

  private async handleProxyRequest(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    const startTime = Date.now();

    // Parse request body
    let body: Record<string, unknown> = {};
    try {
      if (req.body && req.body.length > 0) {
        body = JSON.parse(req.body.toString());
      }
    } catch (e) {
      this.log(`Failed to parse request body: ${e}`);
    }

    // Capture request
    const capturedRequest: CapturedRequest = {
      id: requestId,
      timestamp: new Date().toISOString(),
      model: body.model as string || 'unknown',
      max_tokens: body.max_tokens as number || 0,
      system: body.system as CapturedRequest['system'],
      messages: body.messages as CapturedRequest['messages'] || [],
      tools: body.tools as CapturedRequest['tools'],
      stream: body.stream as boolean,
      metadata: body.metadata as Record<string, unknown>,
    };

    this.storage.logRequest(capturedRequest);
    this.log(`[${requestId.slice(0, 8)}] ${req.method} ${req.path} - Model: ${capturedRequest.model}`);
    this.broadcast({ type: 'request', data: capturedRequest });

    // Prepare proxy request options
    const proxyOptions: https.RequestOptions = {
      hostname: ANTHROPIC_API_HOST,
      port: 443,
      path: req.path,
      method: req.method,
      headers: {
        ...req.headers,
        host: ANTHROPIC_API_HOST,
      },
    };

    // Remove hop-by-hop headers
    const headers = proxyOptions.headers as Record<string, unknown>;
    delete headers['connection'];
    delete headers['keep-alive'];
    delete headers['transfer-encoding'];

    const isStreaming = body.stream === true;

    // Make proxy request
    const proxyReq = https.request(proxyOptions, (proxyRes) => {
      // Forward status and headers
      res.status(proxyRes.statusCode || 500);
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (value && !['connection', 'keep-alive', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      if (isStreaming) {
        this.handleStreamingResponse(requestId, startTime, proxyRes, res, capturedRequest);
      } else {
        this.handleNonStreamingResponse(requestId, startTime, proxyRes, res);
      }
    });

    proxyReq.on('error', (error) => {
      this.log(`Proxy request error: ${error.message}`);
      res.status(502).json({ error: 'Proxy request failed', message: error.message });
    });

    // Forward request body
    if (req.body && req.body.length > 0) {
      proxyReq.write(req.body);
    }
    proxyReq.end();
  }

  private handleStreamingResponse(
    requestId: string,
    startTime: number,
    proxyRes: http.IncomingMessage,
    res: Response,
    _capturedRequest: CapturedRequest
  ): void {
    const parser = new SSEParser();
    const chunks: Buffer[] = [];

    proxyRes.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      res.write(chunk);
      parser.processChunk(chunk.toString());
    });

    proxyRes.on('end', () => {
      res.end();

      const accumulator = parser.getAccumulator();
      const duration = Date.now() - startTime;

      const capturedResponse: CapturedResponse = {
        request_id: requestId,
        timestamp: new Date().toISOString(),
        content: accumulator.content,
        stop_reason: accumulator.stopReason,
        usage: accumulator.usage,
        model: accumulator.model,
        duration_ms: duration,
      };

      this.storage.logResponse(capturedResponse);
      this.log(`[${requestId.slice(0, 8)}] Response complete - ${duration}ms, ${accumulator.usage.output_tokens} output tokens`);
      this.broadcast({ type: 'response', data: capturedResponse });
    });

    proxyRes.on('error', (error) => {
      this.log(`Stream error: ${error.message}`);
      res.end();
    });
  }

  private handleNonStreamingResponse(
    requestId: string,
    startTime: number,
    proxyRes: http.IncomingMessage,
    res: Response
  ): void {
    const chunks: Buffer[] = [];
    const contentEncoding = proxyRes.headers['content-encoding'];

    proxyRes.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    proxyRes.on('end', () => {
      const buffer = Buffer.concat(chunks);
      res.send(buffer);

      const duration = Date.now() - startTime;

      // Decompress if needed for logging
      this.decompressBuffer(buffer, contentEncoding)
        .then((decompressed) => {
          try {
            const responseBody = JSON.parse(decompressed.toString());
            const capturedResponse: CapturedResponse = {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              content: responseBody.content as ContentBlock[] || [],
              stop_reason: responseBody.stop_reason,
              usage: responseBody.usage || { input_tokens: 0, output_tokens: 0 },
              model: responseBody.model || 'unknown',
              duration_ms: duration,
            };

            this.storage.logResponse(capturedResponse);
            this.log(`[${requestId.slice(0, 8)}] Response complete - ${duration}ms`);
            this.broadcast({ type: 'response', data: capturedResponse });
          } catch (e) {
            this.log(`Failed to parse response: ${e}`);
          }
        })
        .catch((e) => {
          this.log(`Failed to decompress response: ${e}`);
        });
    });
  }

  private decompressBuffer(buffer: Buffer, encoding: string | undefined): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (!encoding) {
        resolve(buffer);
        return;
      }

      if (encoding === 'gzip') {
        zlib.gunzip(buffer, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      } else if (encoding === 'deflate') {
        zlib.inflate(buffer, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      } else if (encoding === 'br') {
        zlib.brotliDecompress(buffer, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      } else {
        // Unknown encoding, try as-is
        resolve(buffer);
      }
    });
  }

  private broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const client of this.wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  private log(message: string): void {
    if (this.options.verbose !== false) {
      console.log(`[Proxy] ${message}`);
    }
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.options.port, () => {
        this.log(`Proxy server listening on http://localhost:${this.options.port}`);
        this.log(`Data directory: ${this.options.dataDir}`);
        this.log('');
        this.log('To use with Claude Code, run:');
        this.log(`  ANTHROPIC_BASE_URL=http://localhost:${this.options.port} claude`);
        this.log('');

        // Setup WebSocket server for real-time updates
        this.wss = new WebSocketServer({ server: this.server! });
        this.wss.on('connection', (ws) => {
          this.wsClients.add(ws);
          this.log('WebSocket client connected');

          ws.on('close', () => {
            this.wsClients.delete(ws);
            this.log('WebSocket client disconnected');
          });
        });

        resolve();
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`\nError: Port ${this.options.port} is already in use.`);
          console.error(`\nTo fix this, either:`);
          console.error(`  1. Kill the process using the port: lsof -ti:${this.options.port} | xargs kill -9`);
          console.error(`  2. Use a different port: npm start -- -p 3457\n`);
        }
        reject(err);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.storage.close();

      if (this.wss) {
        this.wss.close();
      }

      if (this.server) {
        this.server.close(() => {
          this.log('Proxy server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getStorage(): JSONLStorage {
    return this.storage;
  }
}
