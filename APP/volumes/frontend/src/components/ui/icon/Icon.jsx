// src/components/ui/icon/Icon.jsx
import React from 'react';
import { ICON_REGISTRY } from './iconRegistry';
import { normalizeName, warnMissingIcon } from './iconNormalizer';
import { DEFAULT_ICON_SIZE, DEFAULT_ICON_CLASSNAME } from './constants';

export const Icon = ({ 
  name, 
  className = DEFAULT_ICON_CLASSNAME, 
  size = DEFAULT_ICON_SIZE,
  ...rest 
}) => {
  // Intentar obtener el icono directamente
  let IconComponent = ICON_REGISTRY[name];
  
  // Si no existe, intentar con nombre normalizado
  if (!IconComponent && typeof name === 'string') {
    const normalizedKey = normalizeName(name);
    IconComponent = ICON_REGISTRY[normalizedKey];
  }
  
  // Último intento con trim
  if (!IconComponent && typeof name === 'string') {
    IconComponent = ICON_REGISTRY[name.trim()];
  }
  
  // Si aún no existe, warning y return null
  if (!IconComponent) {
    warnMissingIcon(name);
    return null;
  }
  
  // Renderizar con tamaño personalizado si se proporciona
  const iconProps = {
    className,
    ...(size !== DEFAULT_ICON_SIZE ? { size } : {}),
    ...rest,
  };
  
  return <IconComponent {...iconProps} />;
};

export default Icon;