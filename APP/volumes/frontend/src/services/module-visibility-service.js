const MODULE_VISIBILITY_EVENT = "itophub:module-visibility-changed";
let pdqModuleEnabled = true;

function dispatchVisibilityChange() {
  window.dispatchEvent(new CustomEvent(MODULE_VISIBILITY_EVENT));
}

export function isPdqModuleEnabled() {
  return pdqModuleEnabled;
}

export function setPdqModuleEnabled(enabled) {
  pdqModuleEnabled = Boolean(enabled);
  dispatchVisibilityChange();
}

export function subscribeToModuleVisibility(callback) {
  const handleChange = () => callback();

  window.addEventListener(MODULE_VISIBILITY_EVENT, handleChange);

  return () => {
    window.removeEventListener(MODULE_VISIBILITY_EVENT, handleChange);
  };
}
