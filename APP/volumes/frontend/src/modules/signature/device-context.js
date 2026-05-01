export function collectSignatureDeviceContext() {
  if (typeof window === "undefined") {
    return {};
  }

  const navigatorRef = window.navigator || {};
  const screenRef = window.screen || {};

  return {
    platform: `${navigatorRef.userAgentData?.platform || navigatorRef.platform || ""}`.trim(),
    language: `${navigatorRef.language || ""}`.trim(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screenWidth: Number(screenRef.width || 0) || null,
    screenHeight: Number(screenRef.height || 0) || null,
    viewportWidth: Number(window.innerWidth || 0) || null,
    viewportHeight: Number(window.innerHeight || 0) || null,
    devicePixelRatio: Number(window.devicePixelRatio || 0) || null,
  };
}
