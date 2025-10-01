import { createMonacoWorkerHarness, } from './worker-harness';
function normaliseBaseConfig(config, astService) {
    const base = { ...(config ?? {}) };
    const astConfig = base.ast ?? {};
    base.ast = {
        ...astConfig,
        mode: astConfig.mode ?? 'primary',
        service: astConfig.service ?? astService ?? null,
    };
    return base;
}
function createHarness(markerSource, validatorConfig, options) {
    return createMonacoWorkerHarness({
        markerSource,
        validatorConfig,
        astService: options.astService,
        createValidator: options.createValidator,
    });
}
function post(scope, message) {
    scope.postMessage(message);
}
export function createMonacoValidationWorker(options = {}) {
    const scope = options.globalScope ?? self;
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
    const rebuildHarness = () => {
        harness = createHarness(markerSource, validatorConfig, options);
    };
    const sendError = (requestId, error) => {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        post(scope, {
            type: 'error',
            requestId,
            error: { message, stack },
        });
    };
    return {
        handleMessage(event) {
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
                        validatorConfig = normaliseBaseConfig({ ...validatorConfig, ...message.config }, options.astService);
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
                    sendError('type' in message ? message.requestId : undefined, new Error('Unknown worker message type'));
                }
            }
        },
        dispose(requestId) {
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
export function installMonacoValidationWorker(options = {}) {
    const controller = createMonacoValidationWorker(options);
    const scope = options.globalScope ?? self;
    scope.onmessage = (event) => {
        controller.handleMessage(event);
    };
    return controller;
}
