/**
* index.jsx
* Punto de entrada del sistema de modales
* Exporta toda la funcionalidad de forma organizada
*/

import React from 'react';

// ====================================
// IMPORTS PRINCIPALES
// ====================================

// Componente principal
import Modal, { useModal } from './Modal.jsx';

// Manager global
import ModalManager, {
 modalState,
 initializeModalSystem,
 isModalSystemReady,
 cleanupModalSystem
} from './ModalManager.jsx';

// Configuración y tipos
import {
 // Constantes
 MODAL_TYPES,
 MODAL_CONFIG,
 MODAL_ICONS,
 MODAL_STYLES,
 MODAL_SIZES,
 MODAL_CLASSES,
 MODAL_DEFAULTS,
 
 // Utilidades
 getModalConfig,
 getModalSizeClasses,
 getModalPositionClasses,
 isValidModalType,
 generateModalId,
 getDefaultTitle
} from './modalTypes.js';

// Renderers por tipo
import { basicModalRenderers } from './types/BasicModals.jsx';
import { interactiveModalRenderers } from './types/InteractiveModals.jsx';
import { dataModalRenderers } from './types/DataModals.jsx';
import { mediaModalRenderers } from './types/MediaModals.jsx';
import { systemModalRenderers } from './types/SystemModals.jsx';

import logger from '@/utils/logger';
const modalLog = logger.scope("modal");

// ====================================
// LAZY INITIALIZATION
// ====================================

let systemInitialized = false;

/**
* Asegurar que el sistema esté listo antes de usar
* Solo se ejecuta cuando realmente se necesita
*/
const ensureSystemReady = () => {
 if (!systemInitialized && typeof window !== 'undefined' && typeof document !== 'undefined') {
   setupModalSystem();
   systemInitialized = true;
 }
};

// ====================================
// FUNCIONES DE INICIALIZACIÓN
// ====================================

/**
* Inicializar sistema completo de modales
* @param {Object} config - Configuración personalizada
* @returns {Object} Estadísticas de inicialización
*/
export const setupModalSystem = (config = {}) => {
 // Solo ejecutar en el navegador
 if (typeof window === 'undefined' || typeof document === 'undefined') {
   return null;
 }

 // Evitar doble inicialización
 if (document.getElementById('modal-root')) {
   return document.getElementById('modal-root');
 }

 // Inyectar estilos CSS críticos si es necesario
 injectCriticalStyles();
 
 // Inicializar el sistema
 const stats = initializeModalSystem(config);
 
 // Auto-cleanup en desarrollo
 if (process.env.NODE_ENV === 'development') {
   window.ModalManager = ModalManager;
   window.modalState = modalState;
 }

 // Cleanup automático en page unload
 const cleanup = () => cleanupModalSystem();
 window.addEventListener('beforeunload', cleanup, { once: true });
 
 return stats;
};

/**
* Inyectar estilos CSS críticos para animaciones
*/
export const injectCriticalStyles = () => {
 if (typeof document === 'undefined') return;
 
 const styleId = 'modal-system-styles';
 if (document.getElementById(styleId)) return;
 
 const styles = `
   /* Modal System Critical Styles */
   .modal-open {
     overflow: hidden;
   }
   
   .modal-manager-root {
     position: fixed;
     top: 0;
     left: 0;
     z-index: 1000;
     pointer-events: none;
   }
   
   .modal-manager-root > * {
     pointer-events: auto;
   }
   
   /* Animaciones de entrada/salida */
   @keyframes modal-fade-in {
     from { opacity: 0; }
     to { opacity: 1; }
   }
   
   @keyframes modal-slide-up {
     from { 
       opacity: 0; 
       transform: translateY(16px) scale(0.95); 
     }
     to { 
       opacity: 1; 
       transform: translateY(0) scale(1); 
     }
   }
   
   @keyframes modal-slide-down {
     from { 
       opacity: 1; 
       transform: translateY(0) scale(1); 
     }
     to { 
       opacity: 0; 
       transform: translateY(16px) scale(0.95); 
     }
   }
   
   /* Utilidades responsive */
   @media (max-width: 640px) {
     .modal-manager-container [class*="max-w-"] {
       max-width: 95vw !important;
       margin: 1rem !important;
     }
   }
 `;
 
 const styleElement = document.createElement('style');
 styleElement.id = styleId;
 styleElement.textContent = styles;
 document.head.appendChild(styleElement);
};

// ====================================
// UTILIDADES GLOBALES
// ====================================

/**
* Verificar estado del sistema
* @returns {Object} Estado completo del sistema
*/
export const getModalSystemStatus = () => {
 ensureSystemReady();
 
 return {
   isReady: isModalSystemReady(),
   stats: ModalManager.getStats(),
   hasOpenModals: ModalManager.hasOpenModals(),
   config: MODAL_CONFIG
 };
};

/**
* Debug del sistema (solo desarrollo)
*/
export const debugModalSystem = () => {
 if (process.env.NODE_ENV !== 'development') {
   modalLog.warn('debugModalSystem solo disponible en desarrollo');
   return;
 }
 
 ensureSystemReady();
 
 const status = getModalSystemStatus();
 modalLog.group('🔍 Modal System Debug');
 modalLog.log('Estado:', status);
 modalLog.log('Modales activos:', modalState.modals);
 modalLog.log('Contenedor:', modalState.container);
 modalLog.groupEnd();
 
 return status;
};

// ====================================
// WRAPPER DEL MODALMANAGER CON LAZY INIT
// ====================================

// Crear un proxy del ModalManager que asegure inicialización
const LazyModalManager = new Proxy(ModalManager, {
 get(target, prop) {
   // Asegurar sistema listo antes de cualquier operación
   ensureSystemReady();
   return target[prop];
 }
});

// ====================================
// SHORTCUTS Y ALIASES
// ====================================

// Aliases para compatibilidad
export const show = (...args) => {
 ensureSystemReady();
 return ModalManager.show(...args);
};

export const close = (...args) => {
 ensureSystemReady();
 return ModalManager.close(...args);
};

export const closeAll = (...args) => {
 ensureSystemReady();
 return ModalManager.closeAll(...args);
};

// Shortcuts para tipos comunes
export const showInfo = (...args) => {
 ensureSystemReady();
 return ModalManager.info(...args);
};

export const showSuccess = (...args) => {
 ensureSystemReady();
 return ModalManager.success(...args);
};

export const showWarning = (...args) => {
 ensureSystemReady();
 return ModalManager.warning(...args);
};

export const showError = (...args) => {
 ensureSystemReady();
 return ModalManager.error(...args);
};

export const showConfirm = (...args) => {
 ensureSystemReady();
 return ModalManager.confirm(...args);
};

export const showForm = (...args) => {
 ensureSystemReady();
 return ModalManager.form(...args);
};

export const showLoading = (...args) => {
 ensureSystemReady();
 return ModalManager.loading(...args);
};

// ====================================
// COMPONENTES WRAPPER
// ====================================

/**
* Provider de contexto para React (opcional)
*/
export const ModalProvider = ({ children, config = {} }) => {
 React.useEffect(() => {
   setupModalSystem(config);
   
   return () => {
     if (process.env.NODE_ENV !== 'production') {
       cleanupModalSystem();
     }
   };
 }, []);
 
 return children;
};

/**
* Hook para usar el sistema de modales en React
*/
export const useModalSystem = () => {
 const [stats, setStats] = React.useState(() => {
   ensureSystemReady();
   return ModalManager.getStats();
 });
 
 React.useEffect(() => {
   ensureSystemReady();
   
   const unsubscribe = ModalManager.subscribe((event, data, newStats) => {
     setStats(newStats);
   });
   
   return unsubscribe;
 }, []);
 
 return {
   ...LazyModalManager,
   stats,
   isReady: isModalSystemReady(),
   hasOpenModals: stats.total > 0
 };
};

// ====================================
// EXPORTS PRINCIPALES
// ====================================

// Export por defecto: el ModalManager con lazy init
export default LazyModalManager;

// Named exports organizados por categoría
export {
 // Componentes principales
 Modal,
 ModalManager,
 useModal,
 
 // Estado y gestión
 modalState,
 
 // Configuración y tipos
 MODAL_TYPES,
 MODAL_CONFIG,
 MODAL_ICONS,
 MODAL_STYLES,
 MODAL_SIZES,
 MODAL_CLASSES,
 MODAL_DEFAULTS,
 
 // Utilidades de configuración
 getModalConfig,
 getModalSizeClasses,
 getModalPositionClasses,
 isValidModalType,
 generateModalId,
 getDefaultTitle,
 
 // Funciones del sistema
 initializeModalSystem,
 isModalSystemReady,
 cleanupModalSystem,
 
 // Renderers (para uso avanzado)
 basicModalRenderers,
 interactiveModalRenderers,
 dataModalRenderers,
 mediaModalRenderers,
 systemModalRenderers
};

// ====================================
// EXPORT ALTERNATIVO PARA COMMONJS
// ====================================

// Para compatibilidad con require()
if (typeof module !== 'undefined' && module.exports) {
 module.exports = LazyModalManager;
 module.exports.Modal = Modal;
 module.exports.ModalManager = LazyModalManager;
 module.exports.useModal = useModal;
 module.exports.MODAL_TYPES = MODAL_TYPES;
 module.exports.setupModalSystem = setupModalSystem;
 module.exports.cleanupModalSystem = cleanupModalSystem;
}
