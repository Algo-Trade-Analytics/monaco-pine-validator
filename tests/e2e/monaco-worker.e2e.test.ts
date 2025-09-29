import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMonacoWorkerClient, type WorkerAdapter } from '../../core/monaco/client';
import type {
  MonacoWorkerInboundMessage,
  MonacoWorkerOutboundMessage,
} from '../../core/monaco/messages';
import {
  createMonacoValidationWorker,
  type CreateWorkerOptions,
  type WorkerController,
} from '../../core/monaco/worker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class InMemoryWorker implements WorkerAdapter {
  private readonly listeners = new Set<(
    event: MessageEvent<MonacoWorkerOutboundMessage>,
  ) => void>();
  private readonly controller: WorkerController;
  private readonly scope: Pick<Worker, 'postMessage'>;
  private readonly pending: MonacoWorkerOutboundMessage[] = [];

  constructor(options: CreateWorkerOptions = {}) {
    this.scope = {
      postMessage: (message: MonacoWorkerOutboundMessage) => {
        if (this.listeners.size === 0) {
          this.pending.push(message);
          return;
        }
        const event = { data: message } as MessageEvent<MonacoWorkerOutboundMessage>;
        for (const listener of this.listeners) {
          listener(event);
        }
      },
    };

    this.controller = createMonacoValidationWorker({
      ...options,
      globalScope: this.scope,
    });
  }

  postMessage(message: MonacoWorkerInboundMessage): void {
    const event = { data: message } as MessageEvent<MonacoWorkerInboundMessage>;
    this.controller.handleMessage(event);
  }

  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<MonacoWorkerOutboundMessage>) => void,
  ): void {
    if (type === 'message') {
      this.listeners.add(listener);
      if (this.pending.length > 0) {
        for (const message of this.pending.splice(0, this.pending.length)) {
          listener({ data: message } as MessageEvent<MonacoWorkerOutboundMessage>);
        }
      }
    }
  }

  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent<MonacoWorkerOutboundMessage>) => void,
  ): void {
    if (type === 'message') {
      this.listeners.delete(listener);
    }
  }

  terminate(): void {
    this.listeners.clear();
    this.pending.length = 0;
    this.controller.dispose();
  }
}

describe('Monaco worker end-to-end', () => {
  afterEach(() => {
    // Vitest automatically waits for promises; nothing to clean up globally.
  });

  it('validates a simple indicator script without errors', async () => {
    const worker = new InMemoryWorker();
    const client = createMonacoWorkerClient({ worker });

    await client.waitUntilReady();

    const source = [
      '//@version=6',
      'indicator("Simple")',
      'plot(close)',
      '',
    ].join('\n');

    const resultMessage = await client.validate({ code: source, version: 1 });

    expect(resultMessage.type).toBe('result');
    expect(resultMessage.payload.result.errors).toHaveLength(0);
    expect(resultMessage.payload.result.warnings).toHaveLength(0);

    await client.dispose();
    client.terminate();
  });

  it('reports validation errors for invalid scripts', async () => {
    const worker = new InMemoryWorker();
    const client = createMonacoWorkerClient({ worker });

    await client.waitUntilReady();

    const source = [
      'indicator("Missing Version")',
      'plot(close)',
      '',
    ].join('\n');

    const resultMessage = await client.validate({ code: source, version: 1 });

    expect(resultMessage.type).toBe('result');
    expect(resultMessage.payload.result.errors.length).toBeGreaterThan(0);

    await client.dispose();
    client.terminate();
  });

  it('validates a popular Pine Script without emitting errors', async () => {
    const worker = new InMemoryWorker();
    const client = createMonacoWorkerClient({ worker });

    await client.waitUntilReady();

    const samplePath = resolve(__dirname, '../popular-pine-scripts/Uptrick-Volatility.pine');
    const source = readFileSync(samplePath, 'utf8');

    const resultMessage = await client.validate({ code: source, version: 1 });

    expect(resultMessage.type).toBe('result');
    if (resultMessage.type === 'result') {
      const codesWithLines = resultMessage.payload.result.errors.map((issue) => ({
        code: issue.code,
        line: issue.line,
      }));
      expect(codesWithLines).toEqual([
        { code: 'PS008', line: 16 },
        { code: 'PS007', line: 133 },
        { code: 'PS007', line: 140 },
        { code: 'PSV6-SWITCH-SYNTAX', line: 121 },
        { code: 'PSV6-SWITCH-SYNTAX', line: 122 },
        { code: 'PSV6-SWITCH-SYNTAX', line: 128 },
        { code: 'PSV6-SWITCH-SYNTAX', line: 135 },
        { code: 'PSV6-TYPE-FUNCTION-PARAM-MISMATCH', line: 19 },
        { code: 'PSV6-TYPE-FUNCTION-PARAM-MISMATCH', line: 20 },
        { code: 'PSV6-FUNCTION-PARAM-TYPE', line: 19 },
        { code: 'PSV6-FUNCTION-PARAM-TYPE', line: 20 },
        { code: 'PSV6-FUNCTION-PARAM-COUNT', line: 92 },
        { code: 'PSV6-FUNCTION-PARAM-TYPE', line: 92 },
        { code: 'PSV6-FUNCTION-PARAM-COUNT', line: 93 },
        { code: 'PSV6-FUNCTION-PARAM-TYPE', line: 93 },
        { code: 'PSV6-FUNCTION-PARAM-COUNT', line: 96 },
        { code: 'PSV6-FUNCTION-PARAM-TYPE', line: 96 },
      ]);
    }

    await client.dispose();
    client.terminate();
  });
});
