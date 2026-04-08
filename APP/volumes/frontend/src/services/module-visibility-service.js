const PDQ_MODULE_ENABLED_KEY = "itophub-pdq-module-enabled";
const MODULE_VISIBILITY_EVENT = "itophub:module-visibility-changed";

function dispatchVisibilityChange() {
  window.dispatchEvent(new CustomEvent(MODULE_VISIBILITY_EVENT));
}

export function isPdqModuleEnabled() {
  const storedValue = localStorage.getItem(PDQ_MODULE_ENABLED_KEY);

  if (storedValue === null) {
    return true;
  }

  return storedValue === "true";
}

export function setPdqModuleEnabled(enabled) {
  localStorage.setItem(PDQ_MODULE_ENABLED_KEY, String(Boolean(enabled)));
  dispatchVisibilityChange();
}

export function subscribeToModuleVisibility(callback) {
  const handleChange = () => callback();

  window.addEventListener(MODULE_VISIBILITY_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(MODULE_VISIBILITY_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}
