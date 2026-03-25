function write(method, scope, ...args) {
  const prefix = scope ? `[${scope}]` : "[app]";

  if (typeof console?.[method] === "function") {
    console[method](prefix, ...args);
    return;
  }

  console.log(prefix, ...args);
}

function createScope(scopeName = "app") {
  return {
    log: (...args) => write("log", scopeName, ...args),
    info: (...args) => write("info", scopeName, ...args),
    warn: (...args) => write("warn", scopeName, ...args),
    error: (...args) => write("error", scopeName, ...args),
    group: (...args) => {
      if (typeof console?.group === "function") {
        console.group(`[${scopeName}]`, ...args);
        return;
      }
      write("log", scopeName, ...args);
    },
    groupEnd: () => {
      if (typeof console?.groupEnd === "function") {
        console.groupEnd();
      }
    },
  };
}

const logger = {
  scope: createScope,
  log: (...args) => write("log", "app", ...args),
  info: (...args) => write("info", "app", ...args),
  warn: (...args) => write("warn", "app", ...args),
  error: (...args) => write("error", "app", ...args),
};

export default logger;
