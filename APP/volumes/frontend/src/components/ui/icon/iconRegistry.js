// src/components/ui/icon/iconRegistry.js
import { baseIcons } from './categories/baseIcons';
import { navigationIcons } from './categories/navigationIcons';
import { actionIcons } from './categories/actionIcons';
import { statusIcons } from './categories/statusIcons';
import { fileIcons } from './categories/fileIcons';
import { generalIcons } from './categories/general';
import { temporaryIcons } from './categories/temporary';

// Combinar todas las categorías
export const ICON_REGISTRY = {
  // Orden sugerido: de más estable a menos estable
  ...baseIcons,
  ...navigationIcons,
  ...actionIcons,
  ...statusIcons,
  ...fileIcons,
  ...generalIcons,
  ...temporaryIcons, // Los temporales al final para fácil localización
};

// Helper para obtener la categoría de un icono (útil para debugging)
export const getIconCategory = (iconName) => {
  if (baseIcons[iconName]) return 'base';
  if (navigationIcons[iconName]) return 'navigation';
  if (actionIcons[iconName]) return 'actions';
  if (statusIcons[iconName]) return 'status';
  if (fileIcons[iconName]) return 'files';
  if (generalIcons[iconName]) return 'general';
  if (temporaryIcons[iconName]) return 'temporary';
  return null;
};

// Helper para listar iconos por categoría
export const getIconsByCategory = (category) => {
  switch (category) {
    case 'base': return Object.keys(baseIcons);
    case 'navigation': return Object.keys(navigationIcons);
    case 'actions': return Object.keys(actionIcons);
    case 'status': return Object.keys(statusIcons);
    case 'files': return Object.keys(fileIcons);
    case 'general': return Object.keys(generalIcons);
    case 'temporary': return Object.keys(temporaryIcons);
    default: return [];
  }
};

export default ICON_REGISTRY;