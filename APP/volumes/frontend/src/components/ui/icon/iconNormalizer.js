// src/components/ui/icon/iconNormalizer.js
import logger from '@/utils/logger';
const iconLog = logger.scope("icon");

const kebabToCamel = (str) =>
  str.replace(/-([a-z])/g, (_, c) => (c ? c.toUpperCase() : ""));

export const normalizeName = (name) => {
  if (typeof name !== "string") return name;
  const raw = name.trim();
  if (!raw) return raw;
  if (raw.includes("-")) return kebabToCamel(raw);
  return raw;
};

export const warnMissingIcon = (name) => {
  if (process.env.NODE_ENV !== "production") {
    iconLog.warn(`[IconManager] Icon "${name}" no está registrado.`);
  }
};