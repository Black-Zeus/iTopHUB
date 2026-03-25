/**
* ModalManager.jsx
* Gestor global del sistema de modales
* API unificada para mostrar cualquier tipo de modal
*/

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from './Modal.jsx';
import {
  generateModalId,
  isValidModalType,
  MODAL_CONFIG,
  MODAL_TYPES
} from './modalTypes.js';


import logger from '@/utils/logger';
const modalLog = logger.scope("modal");

// ====================================
// ESTADO GLOBAL DE MODALES
// ====================================

class ModalState {
  constructor() {
    this.modals = [];
    this.container = null;
    this.root = null;
    this.subscribers = [];
    this.isInitialized = false;
  }

  // Asegurar que el contenedor existe
  ensureContainer() {
    if (!this.container) {
      // Buscar contenedor existente o crear uno
      this.container = document.getElementById('modal-root') || this.createContainer();
    }

    if (!this.root) {
      this.root = createRoot(this.container);
      this.isInitialized = true;
    }

    return this.container;
  }

  // Crear contenedor de modales
  createContainer() {
    const container = document.createElement('div');
    container.id = 'modal-root';
    container.className = 'modal-manager-root';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', 'Modales del sistema');
    document.body.appendChild(container);
    return container;
  }

  // Agregar modal
  addModal(modal) {
    // Validar límite de modales concurrentes
    if (this.modals.length >= MODAL_CONFIG.maxConcurrentModals) {
      modalLog.warn(`ModalManager: Máximo ${MODAL_CONFIG.maxConcurrentModals} modales concurrentes alcanzado`);
      // Cerrar el modal más antiguo
      this.removeModal(this.modals[0].id);
    }

    // Agregar z-index incremental
    modal.zIndex = MODAL_CONFIG.baseZIndex + this.modals.length;

    // Configurar auto-close si corresponde
    if (modal.autoClose) {
      const timeout = typeof modal.autoClose === 'number' ? modal.autoClose : MODAL_CONFIG.defaultAutoClose;
      modal.autoCloseTimer = setTimeout(() => {
        this.removeModal(modal.id);
      }, timeout);
    }

    this.modals.push(modal);
    this.render();
    this.notifySubscribers('modalAdded', modal);

    return modal.id;
  }

  // Remover modal por ID
  removeModal(id) {
    const index = this.modals.findIndex(modal => modal.id === id);
    if (index !== -1) {
      const modal = this.modals[index];

      // ✅ NUEVO: Cleanup de timers
      if (modal.autoCloseTimer) {
        clearTimeout(modal.autoCloseTimer);
        modal.autoCloseTimer = null;
      }

      // ✅ NUEVO: Cleanup de otros timers/intervals si existen
      if (modal.progressTimer) {
        clearInterval(modal.progressTimer);
        modal.progressTimer = null;
      }

      this.modals.splice(index, 1);
      this.render();
      this.notifySubscribers('modalRemoved', modal);

      // ✅ NUEVO: Cleanup adicional después del render
      setTimeout(() => {
        if (modal.cleanup && typeof modal.cleanup === 'function') {
          modal.cleanup();
        }
      }, 100);
    }
  }

  // Remover todos los modales
  removeAll() {
    const removedModals = [...this.modals];

    // ✅ NUEVO: Cleanup de todos los timers antes de remover
    this.modals.forEach(modal => {
      if (modal.autoCloseTimer) {
        clearTimeout(modal.autoCloseTimer);
      }
      if (modal.progressTimer) {
        clearInterval(modal.progressTimer);
      }
      if (modal.cleanup && typeof modal.cleanup === 'function') {
        modal.cleanup();
      }
    });

    this.modals = [];
    this.render();
    this.notifySubscribers('allModalsRemoved', removedModals);
  }

  // Obtener modal por ID
  getModal(id) {
    return this.modals.find(modal => modal.id === id);
  }

  // Obtener modal activo (el último)
  getActiveModal() {
    return this.modals[this.modals.length - 1] || null;
  }

  // Verificar si hay modales abiertos
  hasOpenModals() {
    return this.modals.length > 0;
  }

  // Obtener estadísticas
  getStats() {
    return {
      total: this.modals.length,
      byType: this.modals.reduce((acc, modal) => {
        acc[modal.type] = (acc[modal.type] || 0) + 1;
        return acc;
      }, {}),
      maxConcurrent: MODAL_CONFIG.maxConcurrentModals,
      isInitialized: this.isInitialized
    };
  }

  // Suscribirse a cambios
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  // Notificar suscriptores
  notifySubscribers(event, data) {
    this.subscribers.forEach(callback => {
      try {
        callback(event, data, this.getStats());
      } catch (error) {
        modalLog.error('Error in modal subscriber:', error);
      }
    });
  }

  // Renderizar modales
  render() {
    if (!this.isInitialized) {
      this.ensureContainer();
    }

    try {
      this.root.render(
        <StrictMode>
          <div className="modal-manager-container">
            {this.modals.map(modal => (
              <Modal
                key={modal.id}
                {...modal}
                isOpen={true}
                onClose={() => {
                  modal.onClose?.();         // ✅ ahora sí se expone
                  this.removeModal(modal.id);
                }}
                onAfterClose={() => {
                  // Callback adicional después del cierre
                  modal.onAfterClose?.();
                }}
                style={{ zIndex: modal.zIndex }}
              />
            ))}
          </div>
        </StrictMode>
      );
    } catch (error) {
      modalLog.error('Error rendering modals:', error);
    }
  }

  // Limpiar todo
  cleanup() {
    this.removeAll();
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
    this.subscribers = [];
    this.isInitialized = false;
  }
}

// Instancia global
const modalState = new ModalState();

// ====================================
// API PÚBLICA DEL MANAGER
// ====================================

class ModalManager {

  // ====================================
  // MÉTODOS PRINCIPALES
  // ====================================

  /**
   * Mostrar modal genérico
   * @param {Object} options - Configuración del modal
   * @returns {string} ID del modal
   */
  static show(options = {}) {
    const {
      type = MODAL_TYPES.INFO,
      id = generateModalId(type),
      timeout, // ✅ NUEVO: Soporte para timeout
      ...modalProps
    } = options;

    // Validar tipo
    if (!isValidModalType(type)) {
      modalLog.warn(`ModalManager: Tipo "${type}" no válido. Usando "info".`);
      options.type = MODAL_TYPES.INFO;
    }

    const modal = {
      id,
      type,
      timeout, // ✅ NUEVO: Agregar timeout al modal
      ...modalProps
    };

    return modalState.addModal(modal);
  }

  /**
   * Cerrar modal por ID
   * @param {string} id - ID del modal
   */
  static close(id) {
    modalState.removeModal(id);
  }

  /**
   * Cerrar todos los modales
   */
  static closeAll() {
    modalState.removeAll();
  }

  // ====================================
  // MODALES BÁSICOS
  // ====================================

  /**
   * Modal de información
   * @param {Object} options - Opciones del modal
   */
  static info(options = {}) {
    return this.show({
      type: MODAL_TYPES.INFO,
      title: options.title || 'Información',
      ...options
    });
  }

  /**
   * Modal de éxito
   * @param {Object} options - Opciones del modal
   */
  static success(options = {}) {
    return this.show({
      type: MODAL_TYPES.SUCCESS,
      title: options.title || 'Éxito',
      autoClose: options.autoClose !== undefined ? options.autoClose : 3000,
      ...options
    });
  }

  /**
   * Modal de advertencia
   * @param {Object} options - Opciones del modal
   */
  static warning(options = {}) {
    return this.show({
      type: MODAL_TYPES.WARNING,
      title: options.title || 'Advertencia',
      ...options
    });
  }

  /**
   * Modal de error
   * @param {Object} options - Opciones del modal
   */
  static error(options = {}) {
    return this.show({
      type: MODAL_TYPES.ERROR,
      title: options.title || 'Error',
      ...options
    });
  }

  /**
   * Modal de peligro
   * @param {Object} options - Opciones del modal
   */
  static danger(options = {}) {
    return this.show({
      type: MODAL_TYPES.DANGER,
      title: options.title || 'Peligro',
      closeOnOverlayClick: false,
      closeOnEscape: false,
      ...options
    });
  }

  // ====================================
  // MODALES INTERACTIVOS
  // ====================================

  /**
   * Modal de confirmación
   * @param {Object} options - Opciones del modal
   * @returns {Promise<boolean>} Promesa que resuelve con la decisión del usuario
   */
  static confirm(options = {}) {
    return new Promise((resolve, reject) => {
      // ✅ NUEVO: Soporte para timeout en confirms
      const timeoutId = options.timeout ? setTimeout(() => {
        this.close(modalId);
        reject(new Error('Modal timeout'));
      }, options.timeout) : null;

      const modalId = this.show({
        type: MODAL_TYPES.CONFIRM,
        title: options.title || 'Confirmar Acción',
        closeOnOverlayClick: false,
        closeOnEscape: false,
        ...options,
        onConfirm: () => {
          if (timeoutId) clearTimeout(timeoutId); // ✅ NUEVO: Cleanup timeout
          this.close(modalId);
          options.onConfirm?.();
          resolve(true);
        },
        onCancel: () => {
          if (timeoutId) clearTimeout(timeoutId); // ✅ NUEVO: Cleanup timeout
          this.close(modalId);
          options.onCancel?.();
          resolve(false);
        },
        // ✅ NUEVO: Cleanup function para el modal
        cleanup: () => {
          if (timeoutId) clearTimeout(timeoutId);
        }
      });
    });
  }

  /**
   * Modal de formulario
   * @param {Object} options - Opciones del modal
   * @returns {Promise<Object>} Promesa que resuelve con los datos del formulario
   */
  static form(options = {}) {
    return new Promise((resolve, reject) => {
      const timeoutId = options.timeout ? setTimeout(() => {
        this.close(modalId);
        reject(new Error('Form timeout'));
      }, options.timeout) : null;

      const modalId = this.show({
        type: MODAL_TYPES.FORM,
        title: options.title || 'Formulario',
        size: 'large',
        ...options,
        onSubmit: (data) => {
          if (timeoutId) clearTimeout(timeoutId);
          this.close(modalId);
          options.onSubmit?.(data);
          resolve(data);
        },
        onCancel: () => {
          if (timeoutId) clearTimeout(timeoutId);
          this.close(modalId);
          options.onCancel?.();
          reject(new Error('Form cancelled'));
        },
        cleanup: () => {
          if (timeoutId) clearTimeout(timeoutId);
        }
      });
    });
  }

  /**
   * Modal de wizard/asistente
   * @param {Object} options - Opciones del modal
   * @returns {Promise<Object>} Promesa que resuelve con los datos finales
   */
  static wizard(options = {}) {
    return new Promise((resolve, reject) => {
      const timeoutId = options.timeout ? setTimeout(() => {
        this.close(modalId);
        reject(new Error('Wizard timeout'));
      }, options.timeout) : null;

      const modalId = this.show({
        type: MODAL_TYPES.WIZARD,
        title: options.title || 'Asistente',
        size: 'large',
        ...options,
        onComplete: (data) => {
          if (timeoutId) clearTimeout(timeoutId);
          this.close(modalId);
          options.onComplete?.(data);
          resolve(data);
        },
        onCancel: () => {
          if (timeoutId) clearTimeout(timeoutId);
          this.close(modalId);
          options.onCancel?.();
          reject(new Error('Wizard cancelled'));
        },
        cleanup: () => {
          if (timeoutId) clearTimeout(timeoutId);
        }
      });
    });
  }

  /**
   * Modal de login
   * @param {Object} options - Opciones del modal
   * @returns {Promise<Object>} Promesa que resuelve con las credenciales
   */
  static login(options = {}) {
    return new Promise((resolve, reject) => {
      const timeoutId = options.timeout ? setTimeout(() => {
        this.close(modalId);
        reject(new Error('Login timeout'));
      }, options.timeout) : null;

      const modalId = this.show({
        type: MODAL_TYPES.LOGIN,
        title: options.title || 'Iniciar Sesión',
        ...options,
        onSubmit: (credentials) => {
          if (timeoutId) clearTimeout(timeoutId);
          this.close(modalId);
          options.onSubmit?.(credentials);
          resolve(credentials);
        },
        onCancel: () => {
          if (timeoutId) clearTimeout(timeoutId);
          this.close(modalId);
          options.onCancel?.();
          reject(new Error('Login cancelled'));
        },
        cleanup: () => {
          if (timeoutId) clearTimeout(timeoutId);
        }
      });
    });
  }

  // ====================================
  // MODALES DE DATOS
  // ====================================

  /**
   * Modal de búsqueda
   * @param {Object} options - Opciones del modal
   */
  static search(options = {}) {
    return this.show({
      type: MODAL_TYPES.SEARCH,
      title: options.title || 'Búsqueda Avanzada',
      size: 'large',
      ...options
    });
  }

  /**
   * Modal de tabla de datos
   * @param {Object} options - Opciones del modal
   */
  static datatable(options = {}) {
    return this.show({
      type: MODAL_TYPES.DATATABLE,
      title: options.title || 'Gestión de Datos',
      size: 'xlarge',
      ...options
    });
  }

  /**
   * Modal de calendario
   * @param {Object} options - Opciones del modal
   */
  static calendar(options = {}) {
    return this.show({
      type: MODAL_TYPES.CALENDAR,
      title: options.title || 'Calendario',
      size: 'large',
      ...options
    });
  }

  // ====================================
  // MODALES DE MEDIA
  // ====================================

  /**
   * Modal de imagen
   * @param {Object} options - Opciones del modal
   */
  static image(options = {}) {
    return this.show({
      type: MODAL_TYPES.IMAGE,
      title: options.title || 'Vista Previa',
      size: 'xlarge',
      ...options
    });
  }

  /**
   * Modal de video
   * @param {Object} options - Opciones del modal
   */
  static video(options = {}) {
    return this.show({
      type: MODAL_TYPES.VIDEO,
      title: options.title || 'Reproductor de Video',
      size: 'xlarge',
      ...options
    });
  }

  /**
   * Modal de galería
   * @param {Object} options - Opciones del modal
   */
  static gallery(options = {}) {
    return this.show({
      type: MODAL_TYPES.GALLERY,
      title: options.title || 'Galería',
      size: 'xlarge',
      ...options
    });
  }

  /**
   * Modal de gestor de archivos
   * @param {Object} options - Opciones del modal
   */
  static fileManager(options = {}) {
    return this.show({
      type: MODAL_TYPES.FILEMANAGER,
      title: options.title || 'Gestor de Archivos',
      size: 'xlarge',
      ...options
    });
  }

  // ====================================
  // MODALES DE SISTEMA
  // ====================================

  /**
   * Modal de loading
   * @param {Object} options - Opciones del modal
   */
  static loading(options = {}) {
    return this.show({
      type: MODAL_TYPES.LOADING,
      title: options.title || 'Cargando...',
      size: 'small',
      showCloseButton: false,
      closeOnOverlayClick: false,
      closeOnEscape: false,
      ...options
    });
  }

  /**
   * Modal de progreso
   * @param {Object} options - Opciones del modal
   */
  static progress(options = {}) {
    return this.show({
      type: MODAL_TYPES.PROGRESS,
      title: options.title || 'Procesando...',
      size: 'medium',
      showCloseButton: false,
      closeOnOverlayClick: false,
      closeOnEscape: false,
      ...options
    });
  }

  /**
   * Modal de configuración
   * @param {Object} options - Opciones del modal
   */
  static settings(options = {}) {
    return this.show({
      type: MODAL_TYPES.SETTINGS,
      title: options.title || 'Configuración',
      size: 'xlarge',
      ...options
    });
  }

  /**
   * Modal de ayuda
   * @param {Object} options - Opciones del modal
   */
  static help(options = {}) {
    return this.show({
      type: MODAL_TYPES.HELP,
      title: options.title || 'Centro de Ayuda',
      size: 'large',
      ...options
    });
  }

  /**
   * Modal personalizado
   * @param {Object} options - Opciones del modal
   */
  static custom(options = {}) {
    return this.show({
      type: MODAL_TYPES.CUSTOM,
      title: options.title || 'Modal Personalizado',
      ...options
    });
  }

  // ====================================
  // UTILIDADES
  // ====================================

  /**
   * Actualizar modal existente
   * @param {string} id - ID del modal
   * @param {Object} updates - Propiedades a actualizar
   */
  static update(id, updates) {
    const modal = modalState.getModal(id);
    if (modal) {
      Object.assign(modal, updates);
      modalState.render();
    }
  }

  /**
   * Verificar si hay modales abiertos
   * @returns {boolean}
   */
  static hasOpenModals() {
    return modalState.hasOpenModals();
  }

  /**
   * Obtener estadísticas de modales
   * @returns {Object}
   */
  static getStats() {
    return modalState.getStats();
  }

  /**
   * Suscribirse a eventos de modales
   * @param {Function} callback - Función callback
   * @returns {Function} Función para desuscribirse
   */
  static subscribe(callback) {
    return modalState.subscribe(callback);
  }

  /**
   * Limpiar todo el sistema de modales
   */
  static cleanup() {
    modalState.cleanup();
  }

  // ====================================
  // MÉTODO DE NOTIFICACIÓN RÁPIDA
  // ====================================

  /**
   * Mostrar notificación toast (no modal)
   * @param {Object} options - Opciones de la notificación
   */
  static notify(options = {}) {
    // Esta será una implementación de toast/notification
    // que se puede mostrar sin bloquear la UI
    modalLog.log('Notification:', options);

    // TODO: Implementar sistema de notificaciones toast
    // que aparezcan en esquina y se auto-cierren
  }
}

// ====================================
// FUNCIONES DE INICIALIZACIÓN
// ====================================

/**
* Inicializar el sistema de modales
* @param {Object} config - Configuración personalizada
*/
export const initializeModalSystem = (config = {}) => {
  // Sobrescribir configuración por defecto
  Object.assign(MODAL_CONFIG, config);

  // Asegurar que el contenedor existe
  modalState.ensureContainer();

  modalLog.log('Sistema de modales inicializado');
  return modalState.getStats();
};

/**
* Verificar si el sistema está listo
* @returns {boolean}
*/
export const isModalSystemReady = () => {
  return modalState.isInitialized;
};

/**
* Limpiar sistema de modales
*/
export const cleanupModalSystem = () => {
  modalState.cleanup();
  modalLog.log('Sistema de modales limpiado');
};

// ====================================
// EXPORTS
// ====================================

// Export principal
export default ModalManager;

// Named exports
export {
  ModalManager,
  modalState
};

// Export tipos para conveniencia
export { MODAL_TYPES, MODAL_CONFIG } from './modalTypes.js';