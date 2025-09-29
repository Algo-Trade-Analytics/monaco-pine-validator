import type { ValidatorConfig } from '../types';
import type {
  ConfigureWorkerMessage,
  DisposeWorkerMessage,
  MonacoWorkerInboundMessage,
  MonacoWorkerOutboundMessage,
  ValidateWorkerMessage,
  WorkerConfiguredMessage,
  WorkerDisposedMessage,
  WorkerErrorMessage,
  WorkerResultMessage,
} from './messages';
import type { WorkerValidationRequest } from './worker-harness';

export interface WorkerAdapter {
  postMessage(message: MonacoWorkerInboundMessage): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<MonacoWorkerOutboundMessage>) => void,
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent<MonacoWorkerOutboundMessage>) => void,
  ): void;
  terminate?(): void;
}

interface PendingRequest<TMessage extends MonacoWorkerOutboundMessage> {
  readonly resolve: (message: TMessage) => void;
  readonly reject: (error: Error) => void;
  readonly timeoutId?: ReturnType<typeof setTimeout>;
}

export interface WorkerClientOptions {
  readonly worker: WorkerAdapter;
  readonly requestTimeoutMs?: number;
  readonly onError?: (error: WorkerErrorMessage['error']) => void;
}

export interface ConfigureOptions {
  readonly markerSource?: string;
  readonly config?: Partial<ValidatorConfig>;
}

export interface WorkerReadyState {
  readonly markerSource: string;
  readonly config: Partial<ValidatorConfig>;
  readonly version: number;
}

export interface MonacoWorkerClient {
  isReady(): boolean;
  waitUntilReady(): Promise<WorkerReadyState>;
  getMarkerSource(): string | null;
  getConfig(): Partial<ValidatorConfig> | null;
  getVersion(): number | null;
  configure(options: ConfigureOptions): Promise<WorkerConfiguredMessage>;
  validate(request: WorkerValidationRequest): Promise<WorkerResultMessage>;
  dispose(): Promise<WorkerDisposedMessage>;
  terminate(): void;
}

const DEFAULT_TIMEOUT = 15000;

function createTimeout(
  timeoutMs: number | undefined,
  onTimeout: () => void,
): ReturnType<typeof setTimeout> | undefined {
  if (!timeoutMs || timeoutMs <= 0 || !Number.isFinite(timeoutMs)) {
    return undefined;
  }
  return setTimeout(onTimeout, timeoutMs);
}

export function createMonacoWorkerClient(options: WorkerClientOptions): MonacoWorkerClient {
  const { worker, onError, requestTimeoutMs = DEFAULT_TIMEOUT } = options;
  let disposed = false;
  let markerSource: string | null = null;
  let config: Partial<ValidatorConfig> | null = null;
  let version: number | null = null;
  let readyResolve: ((state: WorkerReadyState) => void) | null = null;
  let readyReject: ((error: Error) => void) | null = null;
  const readyPromise = new Promise<WorkerReadyState>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  let requestCounter = 0;
  const pending = new Map<string, PendingRequest<MonacoWorkerOutboundMessage>>();

  const handleMessage = (event: MessageEvent<MonacoWorkerOutboundMessage>): void => {
    const message = event.data;
    if (!message || typeof message !== 'object') {
      return;
    }

    switch (message.type) {
      case 'ready': {
        markerSource = message.markerSource;
        config = message.config;
        version = message.version;
        if (readyResolve) {
          readyResolve({ markerSource, config, version });
          readyResolve = null;
          readyReject = null;
        }
        break;
      }
      case 'configured':
      case 'result':
      case 'disposed': {
        const requestId = 'requestId' in message ? message.requestId : undefined;
        if (!requestId) {
          return;
        }
        const entry = pending.get(requestId);
        if (!entry) {
          return;
        }
        pending.delete(requestId);
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId);
        }

        if (message.type === 'configured') {
          markerSource = message.markerSource;
          config = message.config;
        }

        entry.resolve(message as WorkerConfiguredMessage | WorkerResultMessage | WorkerDisposedMessage);
        break;
      }
      case 'error': {
        const { requestId, error } = message;
        if (requestId && pending.has(requestId)) {
          const entry = pending.get(requestId)!;
          pending.delete(requestId);
          if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
          }
          entry.reject(new Error(error.message));
          return;
        }
        if (onError) {
          onError(error);
        }
        break;
      }
      default:
        break;
    }
  };

  worker.addEventListener('message', handleMessage);

  const rejectAll = (error: Error): void => {
    for (const [id, entry] of pending.entries()) {
      pending.delete(id);
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      entry.reject(error);
    }
  };

  const ensureNotDisposed = (): void => {
    if (disposed) {
      throw new Error('Worker client has been disposed');
    }
  };

  const awaitReady = async (): Promise<void> => {
    if (markerSource && config && version !== null) {
      return;
    }
    return readyPromise.then(() => undefined);
  };

  const send = <TMessage extends MonacoWorkerInboundMessage>(message: TMessage): void => {
    worker.postMessage(message);
  };

  const enqueue = <TMessage extends MonacoWorkerOutboundMessage>(
    requestId: string,
    resolver: PendingRequest<TMessage>['resolve'],
    rejector: PendingRequest<TMessage>['reject'],
  ): void => {
    const timeoutId = createTimeout(requestTimeoutMs, () => {
      pending.delete(requestId);
      rejector(new Error(`Worker request ${requestId} timed out`));
    });
    pending.set(requestId, { resolve: resolver as (message: MonacoWorkerOutboundMessage) => void, reject: rejector, timeoutId });
  };

  const nextRequestId = (): string => {
    requestCounter += 1;
    return `req-${requestCounter}`;
  };

  return {
    isReady(): boolean {
      return markerSource !== null && config !== null && version !== null;
    },
    waitUntilReady(): Promise<WorkerReadyState> {
      if (this.isReady()) {
        return Promise.resolve({ markerSource: markerSource!, config: config!, version: version! });
      }
      return readyPromise;
    },
    getMarkerSource(): string | null {
      return markerSource;
    },
    getConfig(): Partial<ValidatorConfig> | null {
      return config;
    },
    getVersion(): number | null {
      return version;
    },
    async configure(options: ConfigureOptions): Promise<WorkerConfiguredMessage> {
      ensureNotDisposed();
      await awaitReady();
      const requestId = nextRequestId();
      const message: ConfigureWorkerMessage = {
        type: 'configure',
        requestId,
        markerSource: options.markerSource,
        config: options.config,
      };

      return new Promise<WorkerConfiguredMessage>((resolve, reject) => {
        enqueue(requestId, resolve as (message: MonacoWorkerOutboundMessage) => void, reject);
        send(message);
      });
    },
    async validate(request: WorkerValidationRequest): Promise<WorkerResultMessage> {
      ensureNotDisposed();
      await awaitReady();
      const requestId = nextRequestId();
      const message: ValidateWorkerMessage = {
        type: 'validate',
        requestId,
        payload: request,
      };

      return new Promise<WorkerResultMessage>((resolve, reject) => {
        enqueue(requestId, resolve as (message: MonacoWorkerOutboundMessage) => void, reject);
        send(message);
      });
    },
    async dispose(): Promise<WorkerDisposedMessage> {
      if (disposed) {
        return Promise.resolve({ type: 'disposed', requestId: undefined });
      }
      await awaitReady().catch(() => undefined);
      const requestId = nextRequestId();
      const message: DisposeWorkerMessage = {
        type: 'dispose',
        requestId,
      };

      return new Promise<WorkerDisposedMessage>((resolve, reject) => {
        enqueue(requestId, resolve as (message: MonacoWorkerOutboundMessage) => void, reject);
        send(message);
        disposed = true;
      });
    },
    terminate(): void {
      disposed = true;
      worker.removeEventListener('message', handleMessage);
      if (readyReject) {
        readyReject(new Error('Worker terminated'));
      }
      rejectAll(new Error('Worker terminated'));
      if (worker.terminate) {
        worker.terminate();
      }
    },
  };
}
