import type { WorkerValidationRequest, WorkerValidationResponse } from './worker-harness';
import type { ValidatorConfig } from '../types';

export interface ConfigureWorkerMessage {
  readonly type: 'configure';
  readonly requestId?: string;
  readonly markerSource?: string;
  readonly config?: Partial<ValidatorConfig>;
}

export interface ValidateWorkerMessage {
  readonly type: 'validate';
  readonly requestId: string;
  readonly payload: WorkerValidationRequest;
}

export interface DisposeWorkerMessage {
  readonly type: 'dispose';
  readonly requestId?: string;
}

export type MonacoWorkerInboundMessage =
  | ConfigureWorkerMessage
  | ValidateWorkerMessage
  | DisposeWorkerMessage;

export interface WorkerReadyMessage {
  readonly type: 'ready';
  readonly version: number;
  readonly markerSource: string;
  readonly config: Partial<ValidatorConfig>;
}

export interface WorkerConfiguredMessage {
  readonly type: 'configured';
  readonly requestId?: string;
  readonly markerSource: string;
  readonly config: Partial<ValidatorConfig>;
}

export interface WorkerResultMessage {
  readonly type: 'result';
  readonly requestId: string;
  readonly payload: WorkerValidationResponse;
}

export interface WorkerErrorMessage {
  readonly type: 'error';
  readonly requestId?: string;
  readonly error: {
    readonly message: string;
    readonly stack?: string;
  };
}

export interface WorkerDisposedMessage {
  readonly type: 'disposed';
  readonly requestId?: string;
}

export type MonacoWorkerOutboundMessage =
  | WorkerReadyMessage
  | WorkerConfiguredMessage
  | WorkerResultMessage
  | WorkerErrorMessage
  | WorkerDisposedMessage;
