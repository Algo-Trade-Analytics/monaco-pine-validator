import { describe, expect, it } from 'vitest';
import type { MonacoWorkerInboundMessage, MonacoWorkerOutboundMessage } from '../../core/monaco/messages';
import { createMonacoWorkerClient, type WorkerAdapter } from '../../core/monaco/client';
import type { WorkerValidationResponse } from '../../core/monaco/worker-harness';

class MockWorker implements WorkerAdapter {
  public readonly sent: MonacoWorkerInboundMessage[] = [];
  private readonly listeners = new Set<(event: MessageEvent<MonacoWorkerOutboundMessage>) => void>();
  public terminated = false;

  postMessage(message: MonacoWorkerInboundMessage): void {
    this.sent.push(message);
  }

  addEventListener(
    _type: 'message',
    listener: (event: MessageEvent<MonacoWorkerOutboundMessage>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: 'message',
    listener: (event: MessageEvent<MonacoWorkerOutboundMessage>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  terminate(): void {
    this.terminated = true;
  }

  send(message: MonacoWorkerOutboundMessage): void {
    const event = { data: message } as MessageEvent<MonacoWorkerOutboundMessage>;
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function createReadyMessage(): MonacoWorkerOutboundMessage {
  return {
    type: 'ready',
    markerSource: 'pine-worker',
    version: 1,
    config: { ast: { mode: 'primary', service: null } },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Monaco worker client', () => {
  it('waits for the ready message before reporting readiness', async () => {
    const worker = new MockWorker();
    const client = createMonacoWorkerClient({ worker });

    const readiness = client.waitUntilReady();
    worker.send(createReadyMessage());
    const state = await readiness;

    expect(client.isReady()).toBe(true);
    expect(state.markerSource).toBe('pine-worker');
    expect(state.version).toBe(1);
  });

  it('sends configure, validate, and dispose requests', async () => {
    const worker = new MockWorker();
    const client = createMonacoWorkerClient({ worker, requestTimeoutMs: 0 });
    worker.send(createReadyMessage());

    const configurePromise = client.configure({ markerSource: 'custom', config: { enableWarnings: false } });
    await flushMicrotasks();
    const configureMessage = worker.sent.at(-1);
    if (!configureMessage || configureMessage.type !== 'configure') {
      throw new Error('Expected configure message');
    }
    worker.send({
      type: 'configured',
      requestId: configureMessage.requestId,
      markerSource: 'custom',
      config: { enableWarnings: false, ast: { mode: 'primary', service: null } },
    });
    const configured = await configurePromise;
    expect(configured.markerSource).toBe('custom');

    const validatePromise = client.validate({ code: 'indicator("Test")\nplot(close)', version: 2 });
    await flushMicrotasks();
    const validateMessage = worker.sent.at(-1);
    if (!validateMessage || validateMessage.type !== 'validate') {
      throw new Error('Expected validate message');
    }
    const payload: WorkerValidationResponse = {
      version: 2,
      markers: [],
      syntaxMarkers: [],
      result: { errors: [], warnings: [], scriptType: 'indicator' },
      scriptType: 'indicator',
      semanticModel: { ast: null, symbols: [], scopes: { root: null, nodes: [] }, controlFlow: { entry: null, exit: null, nodes: [] }, types: [] },
      hoverData: [],
    };
    worker.send({
      type: 'result',
      requestId: validateMessage.requestId,
      payload,
    });
    const result = await validatePromise;
    expect(result.payload.version).toBe(2);

    const disposePromise = client.dispose();
    await flushMicrotasks();
    const disposeMessage = worker.sent.at(-1);
    if (!disposeMessage || disposeMessage.type !== 'dispose') {
      throw new Error('Expected dispose message');
    }
    worker.send({ type: 'disposed', requestId: disposeMessage.requestId });
    const disposed = await disposePromise;
    expect(disposed.type).toBe('disposed');
  });

  it('rejects individual requests when the worker reports an error', async () => {
    const worker = new MockWorker();
    const client = createMonacoWorkerClient({ worker });
    worker.send(createReadyMessage());

    const validation = client.validate({ code: 'study("err")', version: 3 });
    await flushMicrotasks();
    const validateMessage = worker.sent.at(-1);
    if (!validateMessage || validateMessage.type !== 'validate') {
      throw new Error('Expected validate message');
    }

    worker.send({
      type: 'error',
      requestId: validateMessage.requestId,
      error: { message: 'boom' },
    });

    await expect(validation).rejects.toThrow('boom');
  });

  it('forwards unhandled errors to the provided callback', async () => {
    const worker = new MockWorker();
    const errors: string[] = [];
    createMonacoWorkerClient({
      worker,
      onError: (error) => {
        errors.push(error.message);
      },
    });
    worker.send(createReadyMessage());

    worker.send({ type: 'error', error: { message: 'unhandled' } });

    expect(errors).toEqual(['unhandled']);
  });
});
