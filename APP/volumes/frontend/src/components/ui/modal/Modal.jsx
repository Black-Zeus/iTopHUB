/**
 * Modal.jsx
 * Componente universal que maneja TODOS los tipos de modal
 * Uso: <Modal type="success" title="Éxito" message="Todo bien" />
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Importar configuración central
import {
  getModalConfig,
  getModalSizeClasses,
  getModalPositionClasses,
  getDefaultTitle,
  generateModalId,
  MODAL_CLASSES,
  MODAL_CONFIG
} from './modalTypes.js';

// Importar renderers por tipo
import { basicModalRenderers } from './types/BasicModals.jsx';
import { interactiveModalRenderers } from './types/InteractiveModals.jsx';
import { dataModalRenderers } from './types/DataModals.jsx';
import { mediaModalRenderers } from './types/MediaModals.jsx';
import { systemModalRenderers } from './types/SystemModals.jsx';


import logger from '@/utils/logger';
const modalLog = logger.scope("modal");

// ====================================
// MAPEO COMPLETO DE RENDERERS
// ====================================

const ALL_MODAL_RENDERERS = {
  ...basicModalRenderers,
  ...interactiveModalRenderers,
  ...dataModalRenderers,
  ...mediaModalRenderers,
  ...systemModalRenderers
};

// ====================================
// HOOK PARA FOCUS MANAGEMENT
// ====================================

const useFocusManagement = (isOpen, modalRef) => {
  const previousFocusRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const lastFocusableRef = useRef(null);

  // Guardar el elemento con foco antes de abrir
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Gestionar foco al abrir
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    firstFocusableRef.current = focusableElements[0];
    lastFocusableRef.current = focusableElements[focusableElements.length - 1];

    // Enfocar primer elemento
    const timer = setTimeout(() => {
      if (firstFocusableRef.current) {
        firstFocusableRef.current.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, modalRef]);

  // Trap focus dentro del modal
  const handleKeyDown = useCallback((e) => {
    if (!isOpen || e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusableRef.current) {
        e.preventDefault();
        lastFocusableRef.current?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusableRef.current) {
        e.preventDefault();
        firstFocusableRef.current?.focus();
      }
    }
  }, [isOpen]);

  // Restaurar foco al cerrar
  const restoreFocus = useCallback(() => {
    if (MODAL_CONFIG.focusManagement.returnFocus && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, []);

  return { handleKeyDown, restoreFocus };
};

// ====================================
// HOOK PARA BODY SCROLL LOCK
// ====================================

const useBodyScrollLock = (isOpen) => {
  useEffect(() => {
    if (!isOpen) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add(MODAL_CONFIG.bodyClass);

    return () => {
      document.body.style.overflow = originalStyle;
      document.body.classList.remove(MODAL_CONFIG.bodyClass);
    };
  }, [isOpen]);
};

// ====================================
// COMPONENTE PRINCIPAL
// ====================================

const Modal = ({
  // Propiedades básicas
  id,
  type = 'info',
  title,
  message,
  content,
  children,

  // Configuración de UI
  size,
  position = 'center',
  showCloseButton,
  showHeader = true,
  showFooter = true,

  // Comportamiento
  isOpen = true,
  closeOnOverlayClick,
  closeOnEscape,
  autoClose,

  // Callbacks
  onClose,
  onOpen,
  onAfterClose,

  // Props específicos por tipo (se pasan al renderer)
  ...modalProps
}) => {
  // ====================================
  // ESTADO LOCAL - SIEMPRE PRIMERO
  // ====================================

  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // ====================================
  // REFS - SIEMPRE EN EL MISMO ORDEN
  // ====================================

  const modalRef = useRef(null);
  const overlayRef = useRef(null);
  const uniqueId = useRef(id || generateModalId(type));

  // ====================================
  // CONFIGURACIÓN MEMOIZADA - TODAS JUNTAS
  // ====================================

  const config = useMemo(() => getModalConfig(type), [type]);
  const modalTitle = useMemo(() => title || getDefaultTitle(type), [title, type]);
  const modalSize = useMemo(() => size || config.size, [size, config.size]);

  const modalSettings = useMemo(() => ({
    showClose: showCloseButton ?? config.showCloseButton,
    closeOnClick: closeOnOverlayClick ?? config.closeOnOverlayClick,
    closeOnEsc: closeOnEscape ?? config.closeOnEscape,
  }), [showCloseButton, config.showCloseButton, closeOnOverlayClick, config.closeOnOverlayClick, closeOnEscape, config.closeOnEscape]);

  // ====================================
  // HOOKS PERSONALIZADOS
  // ====================================

  const { handleKeyDown, restoreFocus } = useFocusManagement(isOpen && isVisible, modalRef);
  useBodyScrollLock(isOpen && isVisible);

  // ====================================
  // HANDLERS ESTABLES
  // ====================================

  const stableHandlers = useMemo(() => ({
    close: () => {
      if (isClosing) return;

      setIsClosing(true);
      setIsAnimating(false);

      // Animación de salida
      setTimeout(() => {
        setIsVisible(false);
        restoreFocus();
        onClose?.();

        // Callback después del cierre
        setTimeout(() => {
          onAfterClose?.();
        }, 50);
      }, MODAL_CONFIG.animationDuration);
    },

    overlayClick: (e) => {
      if (modalSettings.closeOnClick && e.target === overlayRef.current) {
        // Usar la función de cierre del mismo objeto
        stableHandlers.close();
      }
    }
  }), [isClosing, restoreFocus, onClose, onAfterClose, modalSettings.closeOnClick]);

  // Función de cierre expuesta para callbacks externos
  const handleClose = useCallback(() => {
    stableHandlers.close();
  }, [stableHandlers]);

  const handleOverlayClick = useCallback((e) => {
    stableHandlers.overlayClick(e);
  }, [stableHandlers]);

  // ====================================
  // EFECTOS - TODOS JUNTOS
  // ====================================

  // Mostrar modal con animación
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsAnimating(true);
        onOpen?.();
      }, 10);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onOpen]);

  // Auto-close
  useEffect(() => {
    if (!autoClose || !isOpen) return;

    const timer = setTimeout(() => {
      handleClose();
    }, typeof autoClose === 'number' ? autoClose : MODAL_CONFIG.defaultAutoClose);

    return () => clearTimeout(timer);
  }, [autoClose, isOpen, handleClose]);

  // Keyboard listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e) => {
      if (modalSettings.closeOnEsc && e.key === 'Escape') {
        handleClose();
      }
      handleKeyDown(e);
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isOpen, modalSettings.closeOnEsc, handleKeyDown, handleClose]);

  // ====================================
  // CONTENIDO MEMOIZADO
  // ====================================

  const modalContent = useMemo(() => {
    // Obtener el renderer específico del tipo
    const renderModalContent = ALL_MODAL_RENDERERS[type];

    // Si no hay renderer, mostrar contenido básico
    if (renderModalContent) {
      const Comp = renderModalContent;
      // Version Original
      // return <Comp
      //   type={type}
      //   title={modalTitle}
      //   message={message}
      //   content={content || children}
      //   onClose={handleClose}
      //   {...modalProps}
      // />;

      return (
        <Comp
          type={type}
          title={modalTitle}
          message={message}
          content={content || children}
          onClose={handleClose}

          // ✅ Forward explícito de props “consumidas” por Modal.jsx
          showFooter={showFooter}
          showHeader={showHeader}
          size={modalSize}

          {...modalProps}
        />
      );
    }

    // Fallback para tipos no implementados
    return (
      <>
        {/* Body por defecto */}
        <div className={MODAL_CLASSES.bodyContent}>
          {message && <p className="text-gray-600 dark:text-gray-300">{message}</p>}
          {content && (typeof content === 'string' ? <p>{content}</p> : content)}
          {children}
        </div>

        {/* Footer por defecto */}
        {showFooter && (
          <div className={MODAL_CLASSES.footer}>
            <div className={MODAL_CLASSES.footerButtons}>
              <button
                onClick={handleClose}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary}`}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </>
    );
  }, [type, modalTitle, message, content, children, showFooter, handleClose, modalProps]);

  // CLASES CSS MEMOIZADAS
  const cssClasses = useMemo(() => ({
    overlay: `${MODAL_CLASSES.overlay.base} ${getModalPositionClasses(position)}`,
    backdrop: `${MODAL_CLASSES.overlay.backdrop} ${isAnimating ? 'opacity-100' : 'opacity-0'}`,
    modal: `${MODAL_CLASSES.modal.base} ${getModalSizeClasses(modalSize)} ${['clientWide', 'minuteWide', 'pdfViewer', 'personDetail'].includes(modalSize) ? 'max-h-[90vh] overflow-hidden rounded-[26px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-soft)]' : ''} ${isAnimating
        ? MODAL_CLASSES.modal.enterActive
        : MODAL_CLASSES.modal.enter
      }`,
    header: `${MODAL_CLASSES.header.base} ${config.styles?.header || ''}`,
    headerTitle: MODAL_CLASSES.header.title,
    headerClose: MODAL_CLASSES.header.close
  }), [position, isAnimating, modalSize, config.styles]);

  // ====================================
  // RENDER CONDICIONAL
  // ====================================

  if (!isVisible) return null;

  // ====================================
  // RENDER PRINCIPAL
  // ====================================

  const modalElement = (
    <div
      className={cssClasses.overlay}
      style={{ zIndex: MODAL_CONFIG.baseZIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`modal-title-${uniqueId.current}`}
      aria-describedby={`modal-body-${uniqueId.current}`}
    >
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className={cssClasses.backdrop}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* FLEX CONTAINER: Añadido para centrar el modal */}
      <div className={['clientWide', 'minuteWide', 'pdfViewer', 'personDetail'].includes(modalSize) ? 'flex min-h-full items-center justify-center px-0 py-[5vh]' : MODAL_CLASSES.overlay.container}>
        <div
          ref={modalRef}
          className={cssClasses.modal}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {showHeader && (
            <div className={cssClasses.header}>
              <h2
                id={`modal-title-${uniqueId.current}`}
                className={cssClasses.headerTitle}
              >
                {/* Icono del tipo */}
                {config.icon && (
                  <config.icon className={`w-5 h-5 mr-3 inline ${config.styles?.icon || ''}`} />
                )}
                {modalTitle}
              </h2>

              {/* Botón cerrar */}
              {modalSettings.showClose && (
                <button
                  onClick={handleClose}
                  className={cssClasses.headerClose}
                  aria-label={MODAL_CONFIG.accessibility.closeLabel}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* Contenido dinámico según el tipo */}
          <div id={`modal-body-${uniqueId.current}`}>
            {modalContent}
          </div>
        </div>
      </div>
    </div>
  );


  // Renderizar en portal
  const container = document.getElementById('modal-root') || document.body;
  return createPortal(modalElement, container);
};

// ====================================
// COMPONENTE WRAPPER PARA COMPATIBILIDAD
// ====================================

/**
 * Hook para usar modales de forma declarativa
 * @param {Object} config - Configuración del modal
 * @returns {Array} [isOpen, openModal, closeModal]
 */
export const useModal = (config = {}) => {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const ModalComponent = useCallback((props) => (
    <Modal
      {...config}
      {...props}
      isOpen={isOpen}
      onClose={closeModal}
    />
  ), [config, isOpen, closeModal]);

  return [isOpen, openModal, closeModal, ModalComponent];
};

// ====================================
// UTILIDADES DE VALIDACIÓN
// ====================================

/**
 * Valida las props del modal
 * @param {Object} props - Props del modal
 */
const validateModalProps = (props) => {
  if (process.env.NODE_ENV === 'development') {
    const { type, size, position } = props;

    if (type && !ALL_MODAL_RENDERERS[type]) {
      modalLog.warn(`Modal: Tipo "${type}" no implementado. Usando fallback.`);
    }

    if (size && !['small', 'medium', 'large', 'xlarge', 'fullscreen', 'fullscreenWide', 'pdfViewer', 'modalLarge', 'clientWide', 'minuteWide', 'personDetail'].includes(size)) {
      modalLog.warn(`Modal: Tamaño "${size}" no válido. Usando "medium".`);
    }

    if (position && !['center', 'top', 'top-left', 'top-right'].includes(position)) {
      modalLog.warn(`Modal: Posición "${position}" no válida. Usando "center".`);
    }
  }
};

// HOC para validación en desarrollo
const withValidation = (Component) => {
  return (props) => {
    validateModalProps(props);
    return <Component {...props} />;
  };
};

// ====================================
// EXPORT PRINCIPAL
// ====================================

export default process.env.NODE_ENV === 'development' ? withValidation(Modal) : Modal;

// Named exports
export { Modal };
// Export tipos para TypeScript (si se usa)
export * from './modalTypes.js';
