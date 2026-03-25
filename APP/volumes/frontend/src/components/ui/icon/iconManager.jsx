// src/components/ui/icon/iconManager.jsx
import React from "react";
import { ICON_REGISTRY } from './iconRegistry';
import { normalizeName, warnMissingIcon } from './iconNormalizer';

export const Icon = ({ name, className = "", ...rest }) => {
  // Intentar obtener el icono directamente
  let IconComponent = ICON_REGISTRY[name];

  // Si no existe, intentar con nombre normalizado
  if (!IconComponent && typeof name === "string") {
    const normalizedKey = normalizeName(name);
    IconComponent = ICON_REGISTRY[normalizedKey];
  }

  // Último intento con trim
  if (!IconComponent && typeof name === "string") {
    IconComponent = ICON_REGISTRY[name.trim()];
  }

  // Si aún no existe, warning
  if (!IconComponent) {
    warnMissingIcon(name);
    return null;
  }

  return <IconComponent className={className} {...rest} />;
};

export const ICONS = ICON_REGISTRY;
export default Icon;