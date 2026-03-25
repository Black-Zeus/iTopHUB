import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { 
  MODAL_ICONS, 
  MODAL_STYLES, 
  MODAL_CLASSES,
  getModalConfig 
} from '../modalTypes.js';

// ====================================
// MODAL BÁSICO GENÉRICO
// ====================================

export const renderBasicModal = ({
  type,
  title,
  message,
  content,
  buttons,
  onClose,
  onConfirm,
  onCancel,
  details // <-- Nuevo parámetro opcional para error
}) => {
  const [showDetails, setShowDetails] = useState(false); // Sólo usado para error
  const config = getModalConfig(type);
  const IconComponent = config.icon;
  const styles = config.styles;

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {(message || content) && (
          <>
            {/* Alert con estilo específico para tipos básicos */}
            {(type === 'info' || type === 'success' || type === 'warning' || type === 'error' || type === 'danger') && (
              <div className={`${MODAL_CLASSES.alert.base} ${styles.alert}`}>
                <div className="flex items-center">
                  {IconComponent && (
                    <IconComponent className={`${MODAL_CLASSES.alert.icon} ${styles.icon}`} />
                  )}
                  <div className="flex-1">
                    <strong className="font-semibold">
                      {type === 'info' && 'Información:'}
                      {type === 'success' && 'Éxito:'}
                      {type === 'warning' && 'Advertencia:'}
                      {type === 'error' && 'Error:'}
                      {type === 'danger' && 'Peligro:'}
                    </strong>
                    {message && (
                      <div className="mt-1">
                        {typeof message === 'string' ? (
                          <p>{message}</p>
                        ) : (
                          message
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Contenido personalizado adicional */}
            {content && (
              <div className="text-gray-600 dark:text-gray-300 mt-4">
                {typeof content === 'string' ? (
                  <p className="leading-relaxed">{content}</p>
                ) : (
                  content
                )}
              </div>
            )}

            {/* Mensaje para confirm (sin alert styling) */}
            {type === 'confirm' && message && (
              <div className="text-gray-600 dark:text-gray-300">
                <p className="leading-relaxed text-base">{message}</p>
                {content && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                    {content}
                  </p>
                )}
              </div>
            )}

            {/* Sección colapsable SOLO para error */}
            {type === 'error' && details && (
              <div className="bg-gray-50 dark:bg-gray-900/30 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 mt-5">
                <button
                  className="flex items-center text-gray-600 dark:text-gray-300 text-sm font-medium focus:outline-none"
                  onClick={() => setShowDetails(v => !v)}
                  type="button"
                >
                  {showDetails ? (
                    <ChevronDown className="w-4 h-4 mr-2" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-2" />
                  )}
                  Detalles técnicos
                </button>
                {showDetails && (
                  <div className="mt-2 text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300 border-t pt-2 border-gray-100 dark:border-gray-700">
                    {typeof details === 'string'
                      ? details
                      : Array.isArray(details)
                        ? details.map((d, i) => <div key={i}>{d}</div>)
                        : details}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className={MODAL_CLASSES.footerButtons}>
          {type === 'confirm' ? (
            <>
              <button
                onClick={onCancel}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
              >
                {buttons?.cancel || 'Cancelar'}
              </button>
              <button
                onClick={onConfirm}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.danger}`}
              >
                {buttons?.confirm || 'Confirmar'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              {buttons?.close || 'Cerrar'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE INFORMACIÓN
// ====================================

export const renderInfoModal = (props) => {
  return renderBasicModal({
    ...props,
    type: 'info'
  });
};

// ====================================
// MODAL DE ÉXITO
// ====================================

export const renderSuccessModal = (props) => {
  return renderBasicModal({
    ...props,
    type: 'success'
  });
};

// ====================================
// MODAL DE ADVERTENCIA
// ====================================

export const renderWarningModal = (props) => {
  return renderBasicModal({
    ...props,
    type: 'warning'
  });
};

// ====================================
// MODAL DE ERROR
// ====================================

export const renderErrorModal = (props) => {
  return renderBasicModal({
    ...props,
    type: 'error'
  });
};

// ====================================
// MODAL DE PELIGRO
// ====================================

export const renderDangerModal = (props) => {
  return renderBasicModal({
    ...props,
    type: 'danger'
  });
};

// ====================================
// MODAL DE CONFIRMACIÓN
// ====================================

export const renderConfirmModal = (props) => {
  return renderBasicModal({
    ...props,
    type: 'confirm'
  });
};

// ====================================
// NOTIFICACIÓN TOAST
// ====================================

export const renderNotificationModal = ({
  type = 'notification',
  title,
  message,
  content,
  onClose,
  autoClose = true,
  variant = 'info', // info, success, warning, error
  position = 'top-right'
}) => {
  // Configuración de estilos por variante
  const variantStyles = {
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800/30',
      text: 'text-blue-800 dark:text-blue-200',
      icon: 'text-blue-500 dark:text-blue-400'
    },
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800/30',
      text: 'text-green-800 dark:text-green-200',
      icon: 'text-green-500 dark:text-green-400'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800/30',
      text: 'text-yellow-800 dark:text-yellow-200',
      icon: 'text-yellow-500 dark:text-yellow-400'
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800/30',
      text: 'text-red-800 dark:text-red-200',
      icon: 'text-red-500 dark:text-red-400'
    }
  };

  const styles = variantStyles[variant] || variantStyles.info;
  const IconComponent = MODAL_ICONS[variant] || MODAL_ICONS.info;

  // Clases de posición
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
  };

  return (
    <div
      className={`fixed z-50 min-w-[340px] min-h-[40px] max-w-xl ${positionClasses[position]} animate-in slide-in-from-bottom-full duration-300`}
      role="alert"
      aria-live="polite"
    >
      <div className={`
        rounded-lg border shadow-lg backdrop-blur-sm
        ${styles.bg} ${styles.border}
        transition-all duration-200 hover:shadow-xl
      `}>
        <div className="p-4">
          <div className="flex items-start">
            {/* Icono */}
            <div className="flex-shrink-0">
              <IconComponent className={`w-5 h-5 mt-0.5 ${styles.icon}`} />
            </div>

            {/* Contenido */}
            <div className="ml-3 flex-1">
              {title && (
                <div className={`text-sm font-semibold ${styles.text}`}>
                  {title}
                </div>
              )}
              
              {message && (
                <div className={`text-sm mt-1 ${styles.text}`}>
                  {typeof message === 'string' ? (
                    <p>{message}</p>
                  ) : (
                    message
                  )}
                </div>
              )}

              {content && (
                <div className={`text-sm mt-2 ${styles.text} opacity-90`}>
                  {typeof content === 'string' ? (
                    <p>{content}</p>
                  ) : (
                    content
                  )}
                </div>
              )}
            </div>

            {/* Botón cerrar */}
            <div className="ml-4 flex-shrink-0">
              <button
                onClick={onClose}
                className={`
                  inline-flex rounded-md p-1.5 transition-colors
                  ${styles.text} hover:bg-black/5 dark:hover:bg-white/5
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-current
                `}
              >
                <span className="sr-only">Cerrar notificación</span>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barra de progreso para auto-close */}
          {autoClose && typeof autoClose === 'number' && (
            <div className="mt-3 w-full bg-black/10 dark:bg-white/10 rounded-full h-1">
              <div 
                className={`h-1 rounded-full transition-all ease-linear ${
                  variant === 'success' ? 'bg-green-500' :
                  variant === 'warning' ? 'bg-yellow-500' :
                  variant === 'error' ? 'bg-red-500' :
                  'bg-blue-500'
                }`}
                style={{
                  animation: `shrink ${autoClose}ms linear forwards`
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ====================================
// MAPEO DE FUNCIONES RENDER
// ====================================

export const basicModalRenderers = {
  info: renderInfoModal,
  success: renderSuccessModal,
  warning: renderWarningModal,
  error: renderErrorModal,
  danger: renderDangerModal,
  confirm: renderConfirmModal,
  notification: renderNotificationModal
};

// ====================================
// ESTILOS CSS ADICIONALES (para inyectar)
// ====================================

export const notificationStyles = `
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
  
  @keyframes slide-in-from-right-full {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slide-out-to-right-full {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .animate-in {
    animation-fill-mode: both;
  }
  
  .slide-in-from-right-full {
    animation-name: slide-in-from-right-full;
  }
  
  .slide-out-to-right-full {
    animation-name: slide-out-to-right-full;
  }
`;

// ====================================
// EXPORT POR DEFECTO
// ====================================

export default basicModalRenderers;
