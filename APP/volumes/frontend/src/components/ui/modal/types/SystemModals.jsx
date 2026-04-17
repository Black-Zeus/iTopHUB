/**
 * types/SystemModals.jsx
 * Modales del sistema: loading, settings, help, custom
 * Modales para funcionalidades del sistema y configuración
 */

import React from 'react';
import { MODAL_CLASSES } from '../modalTypes.js';

// Importar componentes específicos
import { LoadingSpinner } from './system/LoadingSpinner.jsx';
import { SettingsPanel } from './system/SettingsPanel.jsx';
import { HelpCenter } from './system/HelpCenter.jsx';
import { CustomContent } from './system/CustomContent.jsx';

// ====================================
// MODAL DE LOADING/PROGRESO
// ====================================

export const renderLoadingModal = ({
  type = 'loading',
  title = 'Procesando...',
  message = 'Por favor espere mientras completamos su solicitud',
  progress = 0,
  showProgress = true,
  showCancel = true,
  cancelLabel = 'Cancelar',
  indeterminate = false,
  steps = [],
  currentStep = 0,
  onClose,
  onCancel
}) => {
  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        <LoadingSpinner
          message={message}
          progress={progress}
          showProgress={showProgress}
          indeterminate={indeterminate}
          steps={steps}
          currentStep={currentStep}
        />
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-center w-full">
          {showCancel && (
            <button
              onClick={onCancel || onClose}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE CONFIGURACIÓN
// ====================================

export const renderSettingsModal = ({
  type = 'settings',
  title = 'Configuración del Sistema',
  categories = [
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'security', name: 'Seguridad', icon: '🔒' },
    { id: 'notifications', name: 'Notificaciones', icon: '🔔' },
    { id: 'appearance', name: 'Apariencia', icon: '🎨' }
  ],
  activeCategory = 'general',
  settings = {},
  onClose,
  onSave,
  onCategoryChange,
  onSettingChange
}) => {
  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        <SettingsPanel
          categories={categories}
          activeCategory={activeCategory}
          settings={settings}
          onCategoryChange={onCategoryChange}
          onSettingChange={onSettingChange}
        />
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className={MODAL_CLASSES.footerButtons}>
          <button
            onClick={onClose}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary}`}
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE AYUDA
// ====================================

export const renderHelpModal = ({
  type = 'help',
  title = 'Centro de Ayuda',
  categories = [
    { id: 'getting-started', name: 'Primeros Pasos', icon: '🚀' },
    { id: 'tutorials', name: 'Tutoriales', icon: '📚' },
    { id: 'faq', name: 'Preguntas Frecuentes', icon: '❓' },
    { id: 'contact', name: 'Contacto', icon: '📞' }
  ],
  popularArticles = [
    'Cómo crear un nuevo proyecto',
    'Gestión de usuarios y permisos', 
    'Configuración de notificaciones',
    'Solución de problemas comunes'
  ],
  searchQuery = '',
  onClose,
  onSearch,
  onCategorySelect,
  onArticleSelect,
  onContactSupport
}) => {
  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        <HelpCenter
          categories={categories}
          popularArticles={popularArticles}
          searchQuery={searchQuery}
          onSearch={onSearch}
          onCategorySelect={onCategorySelect}
          onArticleSelect={onArticleSelect}
        />
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className={MODAL_CLASSES.footerButtons}>
          <button
            onClick={onClose}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
          >
            Cerrar
          </button>
          <button
            onClick={onContactSupport}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary}`}
          >
            Contactar Soporte
          </button>
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL PERSONALIZADO
// ====================================

export const renderCustomModal = ({
  type = 'custom',
  title = 'Modal Personalizado',
  content,
  children,
  size = 'medium',
  showHeader = true,
  showFooter = false,
  headerContent,
  footerContent,
  buttons = [],
  onClose,
  onAction,
  ...customProps
}) => {
  // Contenido del cuerpo
  const bodyContent = content || children || (
    <CustomContent
      title="¡Modal Completamente Personalizable!"
      subtitle="Este modal demuestra las capacidades de personalización del sistema"
      features={[
        'Tamaños de modal (small, medium, large, xlarge)',
        'Contenido HTML completamente flexible',
        'Botones personalizados con diferentes estilos',
        'Animaciones y transiciones suaves',
        'Integración con formularios y validaciones',
        'Soporte para multimedia y contenido interactivo'
      ]}
      cards={[
        { title: 'Fácil de usar', subtitle: 'API simple e intuitiva', color: 'blue' },
        { title: 'Responsive', subtitle: 'Funciona en todos los dispositivos', color: 'green' },
        { title: 'Accesible', subtitle: 'Navegación por teclado y ARIA', color: 'yellow' }
      ]}
    />
  );

  // Botones por defecto si no se proporcionan
  const defaultButtons = [
    {
      text: 'Cerrar',
      variant: 'secondary',
      onClick: onClose
    },
    {
      text: 'Acción',
      variant: 'primary',
      onClick: () => onAction?.('default')
    }
  ];

  const modalButtons = buttons.length > 0 ? buttons : defaultButtons;

  return (
    <>
      {/* Header personalizado */}
      {showHeader && headerContent && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          {headerContent}
        </div>
      )}

      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {bodyContent}
      </div>

      {/* Footer personalizado */}
      {showFooter && (
        <div className={MODAL_CLASSES.footer}>
          {footerContent ? (
            footerContent
          ) : (
            <div className={MODAL_CLASSES.footerButtons}>
              {modalButtons.map((button, index) => (
                <button
                  key={index}
                  onClick={button.onClick}
                  disabled={button.disabled}
                  className={`${MODAL_CLASSES.button.base} ${
                    button.variant === 'primary' ? MODAL_CLASSES.button.primary :
                    button.variant === 'success' ? MODAL_CLASSES.button.success :
                    button.variant === 'warning' ? MODAL_CLASSES.button.warning :
                    button.variant === 'danger' ? MODAL_CLASSES.button.danger :
                    MODAL_CLASSES.button.secondary
                  } ${button.className || ''}`}
                >
                  {button.icon && <span className="mr-2">{button.icon}</span>}
                  {button.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

// ====================================
// MODAL DE PROGRESO CON PASOS
// ====================================

export const renderProgressModal = ({
  type = 'progress',
  title = 'Procesando Solicitud',
  steps = [
    'Validando datos',
    'Procesando información',
    'Guardando cambios',
    'Finalizando'
  ],
  currentStep = 0,
  progress = 0,
  message = '',
  showSteps = true,
  showProgress = true,
  allowCancel = true,
  onClose,
  onCancel
}) => {
  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        <div className="text-center py-6">
          {/* Spinner principal */}
          <div
            className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-[var(--border-color)]"
            style={{ borderTopColor: "var(--accent-strong)" }}
          />
          
          {/* Mensaje actual */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {message || (steps[currentStep] || 'Procesando...')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Por favor espere mientras completamos la operación
            </p>
          </div>

          {/* Lista de pasos */}
          {showSteps && steps.length > 0 && (
            <div className="mb-6">
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center text-sm">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                      index < currentStep 
                        ? 'bg-green-500 text-white'
                        : index === currentStep
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }`}>
                      {index < currentStep ? '✓' : index + 1}
                    </div>
                    <span className={
                      index <= currentStep 
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de progreso */}
          {showProgress && (
            <div className="mb-4">
              <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--bg-app)] border border-[var(--border-color)]">
                <div 
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${Math.max(0, Math.min(progress, 100))}%`,
                    background: "linear-gradient(90deg, var(--accent-strong) 0%, #8ec5e8 100%)",
                    boxShadow: "0 0 18px rgba(81,152,194,0.28)",
                  }}
                />
              </div>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                {Math.round(progress)}% completado
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-center w-full">
          {allowCancel && (
            <button
              onClick={onCancel || onClose}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE NOTIFICACIÓN DEL SISTEMA
// ====================================

export const renderSystemNotificationModal = ({
  type = 'system-notification',
  title = 'Notificación del Sistema',
  notification = {},
  actions = [],
  showTimestamp = true,
  autoClose = false,
  onClose,
  onAction,
  onMarkAsRead
}) => {
  const {
    icon = '🔔',
    message = 'Nueva notificación del sistema',
    details,
    priority = 'normal',
    timestamp = new Date(),
    read = false
  } = notification;

  const priorityStyles = {
    low: 'border-gray-300 bg-gray-50 dark:bg-gray-800',
    normal: 'border-blue-300 bg-blue-50 dark:bg-blue-900/20',
    high: 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20',
    critical: 'border-red-300 bg-red-50 dark:bg-red-900/20'
  };

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        <div className={`border-l-4 p-4 rounded ${priorityStyles[priority]}`}>
          <div className="flex items-start">
            <div className="text-2xl mr-3">{icon}</div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                {message}
              </div>
              {details && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {details}
                </div>
              )}
              {showTimestamp && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(timestamp).toLocaleString()}
                </div>
              )}
            </div>
            {!read && (
              <div className="w-3 h-3 bg-primary-500 rounded-full ml-2 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Acciones personalizadas */}
        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={() => onAction?.(action)}
                className={`${MODAL_CLASSES.button.base} ${
                  action.variant === 'primary' ? MODAL_CLASSES.button.primary :
                  action.variant === 'warning' ? MODAL_CLASSES.button.warning :
                  action.variant === 'danger' ? MODAL_CLASSES.button.danger :
                  MODAL_CLASSES.button.secondary
                } text-sm`}
              >
                {action.icon && <span className="mr-1">{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className={MODAL_CLASSES.footerButtons}>
          {!read && (
            <button
              onClick={onMarkAsRead}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              Marcar como leída
            </button>
          )}
          <button
            onClick={onClose}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary}`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
};

// ====================================
// MAPEO DE FUNCIONES RENDER
// ====================================

export const systemModalRenderers = {
  loading: renderLoadingModal,
  progress: renderProgressModal,
  settings: renderSettingsModal,
  help: renderHelpModal,
  custom: renderCustomModal,
  'system-notification': renderSystemNotificationModal
};

// ====================================
// EXPORT POR DEFECTO
// ====================================

export default systemModalRenderers;
