import { describe, expect, it } from 'vitest';
import type { AstValidationContext, ValidatorConfig } from '../../core/types';
import { BaseValidator } from '../../core/base-validator';
import { CoreValidator } from '../../modules/core-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createIndexExpression,
  createNumberLiteral,
  createScriptDeclaration,
  createStringLiteral,
  createUnaryExpression,
  createVersionDirective,
} from './fixtures';
import {
  createLocation,
  createPosition,
  createRange,
  type ProgramNode,
} from '../../core/ast/nodes';
import {
  createMonacoValidationWorker,
  type CreateWorkerOptions,
} from '../../core/monaco/worker';
import type {
  MonacoWorkerInboundMessage,
  MonacoWorkerOutboundMessage,
} from '../../core/monaco/messages';

class CoreWorkerValidator extends BaseValidator {
  constructor(config: Partial<ValidatorConfig>) {
    super(config);
    this.registerModule(new CoreValidator());
  }

  protected runCoreValidation(): void {}

  getAstContext(): AstValidationContext {
    return this.context;
  }
}

function createProgramFromSource(
  source: string,
  directives: ProgramNode['directives'],
  body: ProgramNode['body'],
): ProgramNode {
  const endOffset = source.length;
  const lines = source.split(/\r?\n/);
  const endLine = lines.length || 1;
  const lastLineLength = endLine > 0 ? lines[endLine - 1].length : 0;

  return {
    kind: 'Program',
    directives,
    body,
    loc: createLocation(
      createPosition(1, 1, 0),
      createPosition(endLine, lastLineLength + 1, endOffset),
    ),
    range: createRange(0, endOffset),
  };
}

function createMessageEvent<T>(data: T): MessageEvent<T> {
  return { data } as MessageEvent<T>;
}

async function waitForMessage(
  messages: MonacoWorkerOutboundMessage[],
  predicate: (message: MonacoWorkerOutboundMessage) => boolean,
  timeout = 1000,
): Promise<MonacoWorkerOutboundMessage> {
  const deadline = Date.now() + timeout;

  return new Promise<MonacoWorkerOutboundMessage>((resolve, reject) => {
    const check = () => {
      const found = messages.find(predicate);
      if (found) {
        resolve(found);
        return;
      }

      if (Date.now() >= deadline) {
        reject(new Error('Timed out waiting for worker message'));
        return;
      }

      setTimeout(check, 5);
    };

    check();
  });
}

function createWorker(options: Partial<CreateWorkerOptions>) {
  const messages: MonacoWorkerOutboundMessage[] = [];
  const scope = {
    postMessage: (message: MonacoWorkerOutboundMessage) => {
      messages.push(message);
    },
  } satisfies Pick<DedicatedWorkerGlobalScope, 'postMessage'>;

  const worker = createMonacoValidationWorker({
    globalScope: scope,
    markerSource: 'worker',
    validatorConfig: { ast: { mode: 'primary' } },
    ...options,
  });

  return { worker, scope, messages };
}

describe('Monaco validation worker', () => {
  it('responds to configure and validate messages', async () => {
    const source = [
      '//@version=6',
      'indicator("Example")',
      'values = close[-1]',
      'plot(close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const valuesIdentifier = createIdentifier('values', 0, 3);
    const closeIdentifier = createIdentifier('close', 10, 3);
    const negativeIndex = createUnaryExpression('-', createNumberLiteral(1, '1', 16, 3), 15, 17, 3);
    const historyAccess = createIndexExpression(closeIdentifier, negativeIndex, 10, 17, 3);
    const assignment = createAssignmentStatement(valuesIdentifier, historyAccess, 0, 18, 3);
    const plotCallee = createIdentifier('plot', 0, 4);
    const plotArg = createArgument(createIdentifier('close', 5, 4), 5, 10, 4);
    const plotCall = createCallExpression(plotCallee, [plotArg], 0, 10, 4);
    const plotStatement = createExpressionStatement(plotCall, 0, 10, 4);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, assignment, plotStatement],
    );
    const astService = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const { worker, messages } = createWorker({
      astService,
      createValidator: (config) => new CoreWorkerValidator(config),
    });

    const ready = messages.shift();
    expect(ready).toMatchObject({ type: 'ready', markerSource: 'worker' });

    worker.handleMessage(createMessageEvent<MonacoWorkerInboundMessage>({
      type: 'configure',
      requestId: 'cfg-1',
      markerSource: 'pine-worker',
      config: { enableWarnings: false },
    }));

    const configured = messages.pop();
    expect(configured).toMatchObject({
      type: 'configured',
      requestId: 'cfg-1',
      markerSource: 'pine-worker',
    });

    worker.handleMessage(createMessageEvent<MonacoWorkerInboundMessage>({
      type: 'validate',
      requestId: 'req-1',
      payload: { code: source, version: 1 },
    }));

    const resultMessage = await waitForMessage(
      messages,
      (message) => message.type === 'result',
    );
    expect(resultMessage.type).toBe('result');
    if (resultMessage.type === 'result') {
      expect(resultMessage.payload.markers.some((marker) => marker.code === 'PS024')).toBe(true);
      expect(resultMessage.payload.semanticModel.ast).toBe(program);
      expect(resultMessage.payload.hoverData.some((entry) => entry.name === 'values')).toBe(true);
    }
  });

  it('emits an error message when validation throws', async () => {
    const { worker, messages } = createWorker({
      astService: new FunctionAstService(() => ({
        ast: null,
        diagnostics: createAstDiagnostics(),
      })),
      createValidator: (config) => {
        class ThrowingValidator extends CoreWorkerValidator {
          validate(): never {
            throw new Error('validator failure');
          }
        }
        return new ThrowingValidator(config);
      },
    });

    messages.shift();

    worker.handleMessage(createMessageEvent<MonacoWorkerInboundMessage>({
      type: 'validate',
      requestId: 'req-error',
      payload: { code: 'indicator("Test")', version: 1 },
    }));

    const errorMessage = await waitForMessage(
      messages,
      (message) => message.type === 'error',
    );
    expect(errorMessage.type).toBe('error');
    if (errorMessage.type === 'error') {
      expect(errorMessage.error.message).toContain('validator failure');
      expect(errorMessage.requestId).toBe('req-error');
    }
  });

  it('acknowledges dispose requests', () => {
    const { worker, messages } = createWorker({});
    messages.shift();

    worker.handleMessage(createMessageEvent<MonacoWorkerInboundMessage>({
      type: 'dispose',
      requestId: 'dispose-1',
    }));

    const disposed = messages.pop();
    expect(disposed).toMatchObject({ type: 'disposed', requestId: 'dispose-1' });
  });
});
