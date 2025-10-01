const DEFAULT_TIMEOUT = 15000;
function createTimeout(timeoutMs, onTimeout) {
    if (!timeoutMs || timeoutMs <= 0 || !Number.isFinite(timeoutMs)) {
        return undefined;
    }
    return setTimeout(onTimeout, timeoutMs);
}
export function createMonacoWorkerClient(options) {
    const { worker, onError, requestTimeoutMs = DEFAULT_TIMEOUT } = options;
    let disposed = false;
    let markerSource = null;
    let config = null;
    let version = null;
    let readyResolve = null;
    let readyReject = null;
    const readyPromise = new Promise((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
    });
    let requestCounter = 0;
    const pending = new Map();
    const handleMessage = (event) => {
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
                entry.resolve(message);
                break;
            }
            case 'error': {
                const { requestId, error } = message;
                if (requestId && pending.has(requestId)) {
                    const entry = pending.get(requestId);
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
    const rejectAll = (error) => {
        for (const [id, entry] of pending.entries()) {
            pending.delete(id);
            if (entry.timeoutId) {
                clearTimeout(entry.timeoutId);
            }
            entry.reject(error);
        }
    };
    const ensureNotDisposed = () => {
        if (disposed) {
            throw new Error('Worker client has been disposed');
        }
    };
    const awaitReady = async () => {
        if (markerSource && config && version !== null) {
            return;
        }
        return readyPromise.then(() => undefined);
    };
    const send = (message) => {
        worker.postMessage(message);
    };
    const enqueue = (requestId, resolver, rejector) => {
        const timeoutId = createTimeout(requestTimeoutMs, () => {
            pending.delete(requestId);
            rejector(new Error(`Worker request ${requestId} timed out`));
        });
        pending.set(requestId, { resolve: resolver, reject: rejector, timeoutId });
    };
    const nextRequestId = () => {
        requestCounter += 1;
        return `req-${requestCounter}`;
    };
    return {
        isReady() {
            return markerSource !== null && config !== null && version !== null;
        },
        waitUntilReady() {
            if (this.isReady()) {
                return Promise.resolve({ markerSource: markerSource, config: config, version: version });
            }
            return readyPromise;
        },
        getMarkerSource() {
            return markerSource;
        },
        getConfig() {
            return config;
        },
        getVersion() {
            return version;
        },
        async configure(options) {
            ensureNotDisposed();
            await awaitReady();
            const requestId = nextRequestId();
            const message = {
                type: 'configure',
                requestId,
                markerSource: options.markerSource,
                config: options.config,
            };
            return new Promise((resolve, reject) => {
                enqueue(requestId, resolve, reject);
                send(message);
            });
        },
        async validate(request) {
            ensureNotDisposed();
            await awaitReady();
            const requestId = nextRequestId();
            const message = {
                type: 'validate',
                requestId,
                payload: request,
            };
            return new Promise((resolve, reject) => {
                enqueue(requestId, resolve, reject);
                send(message);
            });
        },
        async dispose() {
            if (disposed) {
                return Promise.resolve({ type: 'disposed', requestId: undefined });
            }
            await awaitReady().catch(() => undefined);
            const requestId = nextRequestId();
            const message = {
                type: 'dispose',
                requestId,
            };
            return new Promise((resolve, reject) => {
                enqueue(requestId, resolve, reject);
                send(message);
                disposed = true;
            });
        },
        terminate() {
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
