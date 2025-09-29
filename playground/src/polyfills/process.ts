const globalScope = globalThis as unknown as {
  process?: { env?: Record<string, string | undefined> };
};

if (!globalScope.process) {
  globalScope.process = { env: {} };
} else if (!globalScope.process.env) {
  globalScope.process.env = {};
}

export {};
