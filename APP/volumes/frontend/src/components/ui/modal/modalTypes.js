/**
 * modalTypes.js
 * Configuración central del sistema de modales
 * Iconos, estilos, constantes y utilidades compartidas
 */

import { 
  Info, CheckCircle, AlertTriangle, XCircle, AlertCircle, Bell,
  Search, Calendar, Settings, HelpCircle, Edit3, User, Lock,
  Image, Video, FolderOpen, Loader2, Play, Grid3X3
} from 'lucide-react';

// ====================================
// CONFIGURACIÓN DE ICONOS POR TIPO
// ====================================

export const MODAL_ICONS = {
  // Básicos
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  danger: AlertCircle,
  notification: Bell,
  
  // Interactivos
  confirm: AlertTriangle,
  form: User,
  wizard: Settings,
  login: Lock,
  
  // Datos
  search: Search,
  datatable: Grid3X3,
  calendar: Calendar,
  
  // Media
  image: Image,
  video: Video,
  gallery: Image,
  filemanager: FolderOpen,
  
  // Sistema
  loading: Loader2,
  progress: Loader2,
  settings: Settings,
  help: HelpCircle,
  custom: Edit3,
  'system-notification': Bell
};

// ====================================
// CONFIGURACIÓN DE ESTILOS POR TIPO
// ====================================

export const MODAL_STYLES = {
  info: {
    icon: 'text-blue-500 dark:text-blue-400',
    header: 'border-blue-100 dark:border-blue-900/30',
    alert: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/30 dark:text-blue-200',
    button: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
  },
  success: {
    icon: 'text-green-500 dark:text-green-400',
    header: 'border-green-100 dark:border-green-900/30',
    alert: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/30 dark:text-green-200',
    button: 'bg-green-600 hover:bg-green-700 text-white border-green-600'
  },
  warning: {
    icon: 'text-yellow-500 dark:text-yellow-400',
    header: 'border-yellow-100 dark:border-yellow-900/30',
    alert: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800/30 dark:text-yellow-200',
    button: 'bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600'
  },
  error: {
    icon: 'text-red-500 dark:text-red-400',
    header: 'border-red-100 dark:border-red-900/30',
    alert: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-200',
    button: 'bg-red-600 hover:bg-red-700 text-white border-red-600'
  },
  danger: {
    icon: 'text-red-500 dark:text-red-400',
    header: 'border-red-100 dark:border-red-900/30',
    alert: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-200',
    button: 'bg-red-600 hover:bg-red-700 text-white border-red-600'
  }
};

// ====================================
// TAMAÑOS DE MODAL
// ====================================

export const MODAL_SIZES = {
  small: {
    width: 'max-w-md',
    padding: 'p-4'
  },
  medium: {
    width: 'max-w-lg',
    padding: 'p-6'
  },
  large: {
    width: 'max-w-2xl',
    padding: 'p-6'
  },
  xlarge: {
    width: 'max-w-4xl',
    padding: 'p-8'
  },
  modalLarge: {
  width: 'max-w-5xl',
  padding: 'p-8',
  maxHeight: 'max-h-[90vh]'
},
  clientWide: {
    width: '!w-[50vw] !max-w-[50vw]',
    padding: 'p-6'
  },
  personDetail: {
    width: '!w-[960px] !max-w-[960px]',
    padding: 'p-0'
  },
  minuteWide: {
    width: '!w-[50vw] !max-w-[50vw]',
    padding: 'p-6'
  },
  pdfViewer: {
    width: '!w-[80vw] !max-w-[80vw]',
    padding: 'p-6'
  },
  fullscreen: {
    width: 'max-w-7xl min-h-screen',
    padding: 'p-8',
  },
  fullscreenWide: {
    width: 'max-w-7xl',   // igual ancho que fullscreen, sin min-h-screen
    padding: 'p-8'        // mismo padding que fullscreen/xlarge
    
  }
};

// ====================================
// CONFIGURACIÓN DE POSICIÓN
// ====================================

export const MODAL_POSITIONS = {
  center: 'items-center justify-center',
  top: 'items-start justify-center pt-16',
  'top-left': 'items-start justify-start p-8',
  'top-right': 'items-start justify-end p-8',
  'bottom-left': 'items-end justify-start p-8',
  'bottom-right': 'items-end justify-end p-8'
};

// ====================================
// CLASES CSS PREDEFINIDAS
// ====================================

export const MODAL_CLASSES = {
  // Overlay principal
  overlay: {
    base: 'fixed inset-0 z-50 overflow-y-auto',
    backdrop: 'fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity',
    container: 'flex min-h-full items-center justify-center p-4'
  },

  // Modal principal
  modal: {
    //base: 'relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow-xl transition-all duration-200 border border-gray-200 dark:border-gray-700',
    base: 'relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow-xl transition-all duration-200 min-h-[120px]',
    enter: 'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95',
    enterActive: 'opacity-100 translate-y-0 sm:scale-100',
    exit: 'opacity-100 translate-y-0 sm:scale-100',
    exitActive: 'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'
  },

  // Header
  header: {
    base: 'flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700  border-none',
    title: 'text-lg font-semibold text-gray-900 dark:text-gray-100 leading-6 -ml-3',
    close: 'rounded-md p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors'
  },

  // Body
  body: {
    base: 'p-6',
    content: 'text-gray-600 dark:text-gray-300 leading-relaxed'
  },
  bodyContent: 'p-6',

  // Footer
  footer: 'px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700',
  footerButtons: 'flex items-center justify-end space-x-3',

  // Botones
  button: {
    base: 'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed',
    primary: 'bg-primary-600 hover:bg-primary-700 text-white border-primary-600 focus:ring-primary-500',
    secondary: 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
    success: 'bg-green-600 hover:bg-green-700 text-white border-green-600 focus:ring-green-500',
    warning: 'bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600 focus:ring-yellow-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white border-red-600 focus:ring-red-500'
  },

  // Alerts
  alert: {
    base: 'rounded-md p-4 border-l-4 mb-4',
    icon: 'w-5 h-5 mr-3 flex-shrink-0'
  },

  // Formularios
  form: {
    group: 'mb-4',
    label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
    required: 'text-red-500 ml-1',
    input: 'block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-gray-100 transition-colors',
    error: 'mt-1 text-sm text-red-600 dark:text-red-400',
    help: 'mt-1 text-xs text-gray-500 dark:text-gray-400'
  }
};

// ====================================
// CONFIGURACIÓN POR DEFECTO POR TIPO
// ====================================

export const MODAL_DEFAULTS = {
  info: {
    size: 'medium',
    showCloseButton: true,
    closeOnOverlayClick: true,
    closeOnEscape: true
  },
  success: {
    size: 'medium',
    showCloseButton: true,
    closeOnOverlayClick: true,
    closeOnEscape: true,
    autoClose: 3000
  },
  warning: {
    size: 'medium',
    showCloseButton: true,
    closeOnOverlayClick: false,
    closeOnEscape: true
  },
  error: {
    size: 'medium',
    showCloseButton: true,
    closeOnOverlayClick: false,
    closeOnEscape: true
  },
  danger: {
    size: 'medium',
    showCloseButton: true,
    closeOnOverlayClick: false,
    closeOnEscape: false
  },
  confirm: {
    size: 'medium',
    showCloseButton: false,
    closeOnOverlayClick: false,
    closeOnEscape: false
  },
  form: {
    size: 'large',
    showCloseButton: true,
    closeOnOverlayClick: false,
    closeOnEscape: true
  },
  wizard: {
    size: 'large',
    showCloseButton: false,
    closeOnOverlayClick: false,
    closeOnEscape: false
  },
  login: {
    size: 'medium',
    showCloseButton: true,
    closeOnOverlayClick: true,
    closeOnEscape: true
  },
  search: {
    size: 'large',
    showCloseButton: true,
    closeOnOverlayClick: true,
    closeOnEscape: true
  },
  datatable: {
    size: 'xlarge',
    showCloseButton: true,
    closeOnOverlayClick: false,
    closeOnEscape: true
  },
  calendar: {
    size: 'large',
    showCloseButton: true,
    closeOnOverlayClick: true,
    closeOnEscape: true
  },
  image: {
    size: 'xlarge',
    showCloseButton: true,
    closeOnOverlayClick: true,
    closeOnEscape: true
  },
  video: {
    size: 'xlarge',
    showCloseButton: true,
    closeOnOverlayClick: false,
    closeOnEscape: true
  },
  gallery: {
    size: 'xlarge',
    showCloseButton: true,
    closeOnOverlayClick: false,
    closeOnEscape: true
  },
  filemanager: {
    size: 'xlarge',
    showCloseButton: true,
    closeOnOverlayClick: false,
    closeOnEscape: true
  },
  loading: {
    size: 'small',
    showCloseButton: false,
    closeOnOverlayClick: false,
    closeOnEscape: false
  },
  progress: {
    size: 'medium',
    showCloseButton: false,
    closeOnOverlayClick: false,
    closeOnEscape: false
  },
  settings: {
    size: 'xlarge',
    showCloseButton: true,
    closeOnOverlayClick: false,
    closeOnEscape: true
  },
  help: {
    size: 'large',
    showCloseButton: true,
    closeOnOverlayClick: true,
    closeOnEscape: true
  },
  custom: {
    size: 'medium',
    showCloseButton: true,
    closeOnOverlayClick: true,
    closeOnEscape: true
  }
};

// ====================================
// TIPOS DE MODAL VÁLIDOS
// ====================================

export const MODAL_TYPES = {
  // Básicos
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  DANGER: 'danger',
  NOTIFICATION: 'notification',
  
  // Interactivos
  CONFIRM: 'confirm',
  FORM: 'form',
  WIZARD: 'wizard',
  LOGIN: 'login',
  
  // Datos
  SEARCH: 'search',
  DATATABLE: 'datatable',
  CALENDAR: 'calendar',
  
  // Media
  IMAGE: 'image',
  VIDEO: 'video',
  GALLERY: 'gallery',
  FILEMANAGER: 'filemanager',
  
  // Sistema
  LOADING: 'loading',
  PROGRESS: 'progress',
  SETTINGS: 'settings',
  HELP: 'help',
  CUSTOM: 'custom'
};

// ====================================
// UTILIDADES
// ====================================

/**
 * Obtiene la configuración completa para un tipo de modal
 * @param {string} type - Tipo de modal
 * @returns {Object} Configuración del modal
 */
export const getModalConfig = (type) => {
  const defaults = MODAL_DEFAULTS[type] || MODAL_DEFAULTS.custom;
  const icon = MODAL_ICONS[type] || MODAL_ICONS.custom;
  const styles = MODAL_STYLES[type] || {};
  
  return {
    type,
    icon,
    styles,
    ...defaults
  };
};

/**
 * Genera clases CSS para el tamaño del modal
 * @param {string} size - Tamaño del modal
 * @returns {string} Clases CSS
 */
export const getModalSizeClasses = (size = 'medium') => {
  const sizeConfig = MODAL_SIZES[size] || MODAL_SIZES.medium;
  return `${sizeConfig.width} w-full`;
};

/**
 * Genera clases CSS para la posición del modal
 * @param {string} position - Posición del modal
 * @returns {string} Clases CSS
 */
export const getModalPositionClasses = (position = 'center') => {
  return MODAL_POSITIONS[position] || MODAL_POSITIONS.center;
};

/**
 * Valida si un tipo de modal es válido
 * @param {string} type - Tipo de modal
 * @returns {boolean} Si es válido
 */
export const isValidModalType = (type) => {
  return Object.values(MODAL_TYPES).includes(type);
};

/**
 * Genera un ID único para el modal
 * @param {string} type - Tipo de modal
 * @returns {string} ID único
 */
export const generateModalId = (type = 'modal') => {
  return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Obtiene el título por defecto para un tipo de modal
 * @param {string} type - Tipo de modal
 * @returns {string} Título por defecto
 */
export const getDefaultTitle = (type) => {
  const titles = {
    info: 'Información',
    success: 'Éxito',
    warning: 'Advertencia',
    error: 'Error',
    danger: 'Peligro',
    confirm: 'Confirmar Acción',
    form: 'Formulario',
    wizard: 'Asistente',
    login: 'Iniciar Sesión',
    search: 'Búsqueda',
    datatable: 'Tabla de Datos',
    calendar: 'Calendario',
    image: 'Vista Previa',
    video: 'Reproductor de Video',
    gallery: 'Galería',
    filemanager: 'Gestor de Archivos',
    loading: 'Cargando...',
    progress: 'Progreso',
    settings: 'Configuración',
    help: 'Ayuda',
    custom: 'Modal'
  };
  
  return titles[type] || 'Modal';
};

// ====================================
// CONFIGURACIÓN GLOBAL
// ====================================

export const MODAL_CONFIG = {
  // Z-index base para modales
  baseZIndex: 1000,
  
  // Animaciones
  animationDuration: 200,
  
  // Auto-close por defecto (en ms)
  defaultAutoClose: 5000,
  
  // Máximo número de modales simultáneos
  maxConcurrentModals: 5,
  
  // Clase CSS para el body cuando hay modal abierto
  bodyClass: 'modal-open',
  
  // Selector del contenedor de modales
  containerSelector: '#modal-root',
  
  // Focus management
  focusManagement: {
    returnFocus: true,
    trapFocus: true,
    initialFocus: 'first-input'
  },
  
  // Accesibilidad
  accessibility: {
    closeLabel: 'Cerrar modal',
    loadingLabel: 'Cargando contenido',
    errorLabel: 'Error en el modal'
  }
};

// ====================================
// EXPORT POR DEFECTO
// ====================================

export default {
  MODAL_ICONS,
  MODAL_STYLES,
  MODAL_SIZES,
  MODAL_POSITIONS,
  MODAL_CLASSES,
  MODAL_DEFAULTS,
  MODAL_TYPES,
  MODAL_CONFIG,
  getModalConfig,
  getModalSizeClasses,
  getModalPositionClasses,
  isValidModalType,
  generateModalId,
  getDefaultTitle
};
