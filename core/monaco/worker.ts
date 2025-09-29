import type { AstService, AstConfig } from '../ast/types';
import type { ValidatorConfig } from '../types';
import {
  createMonacoWorkerHarness,
  type MonacoWorkerHarness,
  type WorkerHarnessOptions,
} from './worker-harness';
import type {
  MonacoWorkerInboundMessage,
  MonacoWorkerOutboundMessage,
} from './messages';

// Declare DedicatedWorkerGlobalScope for Web Worker environment
declare global {
  interface DedicatedWorkerGlobalScope {
    postMessage(message: any): void;
    onmessage: ((event: MessageEvent) => void) | null;
  }
}

export interface WorkerController {
  handleMessage(event: MessageEvent<MonacoWorkerInboundMessage>): void;
  dispose(requestId?: string): void;
}

export interface CreateWorkerOptions extends WorkerHarnessOptions {
  readonly markerSource?: string;
  readonly validatorConfig?: Partial<ValidatorConfig>;
  readonly version?: number;
  readonly globalScope?: Pick<DedicatedWorkerGlobalScope, 'postMessage' | 'onmessage'>;
}

function normaliseBaseConfig(
  config: Partial<ValidatorConfig> | undefined,
  astService: AstService | undefined,
): Partial<ValidatorConfig> {
  const base = { ...(config ?? {}) };
  const astConfig: Partial<AstConfig> = base.ast ?? {};
  base.ast = {
    ...astConfig,
    mode: astConfig.mode ?? 'primary',
    service: astConfig.service ?? astService ?? null,
  };
  return base;
}

function createHarness(
  markerSource: string,
  validatorConfig: Partial<ValidatorConfig>,
  options: WorkerHarnessOptions,
): MonacoWorkerHarness {
  return createMonacoWorkerHarness({
    markerSource,
    validatorConfig,
    astService: options.astService,
    createValidator: options.createValidator,
  });
}

function post(
  scope: Pick<DedicatedWorkerGlobalScope, 'postMessage'>,
  message: MonacoWorkerOutboundMessage,
): void {
  scope.postMessage(message);
}

export function createMonacoValidationWorker(
  options: CreateWorkerOptions = {},
): WorkerController {
  const scope = options.globalScope ?? (self as unknown as DedicatedWorkerGlobalScope);
  let markerSource = options.markerSource ?? 'pine-validator';
  let validatorConfig = normaliseBaseConfig(options.validatorConfig, options.astService);
  let harness = createHarness(markerSource, validatorConfig, options);
  let disposed = false;

  post(scope, {
    type: 'ready',
    version: options.version ?? 1,
    markerSource,
    config: validatorConfig,
  });

  const rebuildHarness = (): void => {
    harness = createHarness(markerSource, validatorConfig, options);
  };

  const sendError = (requestId: string | undefined, error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    post(scope, {
      type: 'error',
      requestId,
      error: { message, stack },
    });
  };

  return {
    handleMessage(event: MessageEvent<MonacoWorkerInboundMessage>): void {
      if (disposed) {
        return;
      }

      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }

      switch (message.type) {
        case 'configure': {
          if (message.markerSource !== undefined) {
            markerSource = message.markerSource;
          }
          if (message.config) {
            validatorConfig = normaliseBaseConfig(
              { ...validatorConfig, ...message.config },
              options.astService,
            );
          }
          rebuildHarness();
          post(scope, {
            type: 'configured',
            requestId: message.requestId,
            markerSource,
            config: validatorConfig,
          });
          break;
        }

        case 'validate': {
          const requestId = message.requestId;
          if (!requestId) {
            sendError(undefined, new Error('validate message missing requestId'));
            break;
          }

          void harness
            .validate({
              ...message.payload,
            })
            .then((response) => {
              post(scope, {
                type: 'result',
                requestId,
                payload: response,
              });
            })
            .catch((error) => {
              sendError(requestId, error);
            });
          break;
        }

        case 'dispose': {
          this.dispose(message.requestId);
          break;
        }

        default: {
          sendError('type' in message ? (message as { requestId?: string }).requestId : undefined, new Error('Unknown worker message type'));
        }
      }
    },

    dispose(requestId?: string): void {
      if (disposed) {
        return;
      }
      disposed = true;
      post(scope, {
        type: 'disposed',
        requestId,
      });
    },
  };
}

export function installMonacoValidationWorker(
  options: CreateWorkerOptions = {},
): WorkerController {
  const controller = createMonacoValidationWorker(options);
  const scope = options.globalScope ?? (self as unknown as DedicatedWorkerGlobalScope);

  scope.onmessage = (event: MessageEvent<MonacoWorkerInboundMessage>) => {
    controller.handleMessage(event);
  };

  return controller;
}
