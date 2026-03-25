/**
 * types/InteractiveModals.jsx
 * Modales interactivos: confirm, form, wizard, login
 * Modales que requieren interacción del usuario y manejo de datos
 */

import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Eye, EyeOff } from 'lucide-react';
import {
  MODAL_CLASSES,
  getModalConfig
} from '../modalTypes.js';


import logger from '@/utils/logger';
const modalLog = logger.scope("modal");


// ====================================
// MODAL DE CONFIRMACIÓN
// ====================================

const ConfirmModal = ({
  type = 'confirm',
  title,
  message,
  content,
  buttons,
  variant = 'danger', // danger, warning, info
  onClose,
  onConfirm,
  onCancel
}) => {
  const config = getModalConfig(type);
  const IconComponent = config.icon;

  // Estilos según la variante
  const variantStyles = {
    danger: {
      icon: 'text-red-500 dark:text-red-400',
      confirmButton: MODAL_CLASSES.button.danger
    },
    warning: {
      icon: 'text-yellow-500 dark:text-yellow-400',
      confirmButton: MODAL_CLASSES.button.warning
    },
    info: {
      icon: 'text-blue-500 dark:text-blue-400',
      confirmButton: MODAL_CLASSES.button.primary
    }
  };

  const styles = variantStyles[variant] || variantStyles.danger;

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        <div className="flex items-start space-x-4">
          {/* Icono */}
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-red-100 dark:bg-red-900/20' :
                variant === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-blue-100 dark:bg-blue-900/20'
              }`}>
              <IconComponent className={`w-6 h-6 ${styles.icon}`} />
            </div>
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            {message && (
              <p className="text-gray-900 dark:text-gray-100 text-base leading-relaxed">
                {message}
              </p>
            )}

            {content && (
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {typeof content === 'string' ? (
                  <p>{content}</p>
                ) : (
                  content
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className={MODAL_CLASSES.footerButtons}>
          <button
            onClick={onCancel || onClose}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
          >
            {buttons?.cancel || 'Cancelar'}
          </button>
          <button
            onClick={onConfirm}
            className={`${MODAL_CLASSES.button.base} ${styles.confirmButton}`}
          >
            {buttons?.confirm || 'Confirmar'}
          </button>
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE FORMULARIO
// ====================================

const FormModal = ({
  type = 'form',
  title,
  message,
  fields = [],
  data = {},
  buttons,
  validation = {},
  onClose,
  onSubmit,
  onChange
}) => {
  const [formData, setFormData] = useState(data);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Manejar cambios en los campos
  const handleInputChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }

    // Callback externo
    onChange?.(name, value, formData);
  }, [onChange, formData, errors]);

  // Validar formulario
  const validateForm = useCallback(() => {
    const newErrors = {};

    fields.forEach(field => {
      const value = formData[field.name];

      // Campo requerido
      if (field.required && (!value || value.toString().trim() === '')) {
        newErrors[field.name] = `${field.label} es requerido`;
        return;
      }

      // Validación por tipo
      if (value && field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.name] = 'Email inválido';
        }
      }

      // Validación personalizada
      if (validation[field.name] && value) {
        const customError = validation[field.name](value, formData);
        if (customError) {
          newErrors[field.name] = customError;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields, formData, validation]);

  // Manejar envío
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();

    if (isSubmitting) return;

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit?.(formData);
    } catch (error) {
      modalLog.error('Error submitting form:', error);
      // Aquí podrías mostrar un error global
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, isSubmitting, validateForm]);

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {message && (
          <div className="mb-6 text-gray-600 dark:text-gray-400">
            <p>{message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {fields.map((field, index) => (
            <div key={field.name || index} className={MODAL_CLASSES.form.group}>
              <label className={MODAL_CLASSES.form.label}>
                {field.label}
                {field.required && <span className={MODAL_CLASSES.form.required}>*</span>}
              </label>

              {/* Textarea */}
              {field.type === 'textarea' ? (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  rows={field.rows || 3}
                  className={`${MODAL_CLASSES.form.input} ${errors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                    }`}
                />
              ) :

                /* Select */
                field.type === 'select' ? (
                  <select
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    className={`${MODAL_CLASSES.form.input} ${errors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                      }`}
                  >
                    <option value="">{field.placeholder || `Seleccionar ${field.label}`}</option>
                    {field.options?.map((option, idx) => (
                      <option key={idx} value={option.value || option}>
                        {option.label || option}
                      </option>
                    ))}
                  </select>
                ) :

                  /* Input regular */
                  (
                    <input
                      type={field.type || 'text'}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className={`${MODAL_CLASSES.form.input} ${errors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                    />
                  )}

              {/* Error del campo */}
              {errors[field.name] && (
                <p className={MODAL_CLASSES.form.error}>
                  {errors[field.name]}
                </p>
              )}

              {/* Ayuda del campo */}
              {field.help && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {field.help}
                </p>
              )}
            </div>
          ))}
        </form>
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className={MODAL_CLASSES.footerButtons}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
          >
            {buttons?.cancel || 'Cancelar'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSubmitting ? 'Guardando...' : (buttons?.submit || 'Guardar')}
          </button>
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE WIZARD (ASISTENTE)
// ====================================

const WizardModal_v1 = ({
  type = 'wizard',
  title,
  steps = [],
  data = {},
  buttons,
  validation = {},
  onClose,
  onComplete,
  onStepChange
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(data);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState({});

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Manejar cambios en los campos
  const handleInputChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    // Limpiar error del campo
    if (stepErrors[name]) {
      setStepErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [stepErrors]);

  // Validar paso actual
  const validateCurrentStep = useCallback(() => {
    if (!currentStepData?.fields) return true;

    const errors = {};

    currentStepData.fields.forEach(field => {
      const value = formData[field.name];

      if (field.required && (!value || value.toString().trim() === '')) {
        errors[field.name] = `${field.label} es requerido`;
        return;
      }

      if (validation[field.name] && value) {
        const customError = validation[field.name](value, formData);
        if (customError) {
          errors[field.name] = customError;
        }
      }
    });

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentStepData, formData, validation]);

  // Ir al siguiente paso
  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;

    if (isLastStep) {
      handleComplete();
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep, formData);
    }
  }, [currentStep, isLastStep, validateCurrentStep, formData, onStepChange]);

  // Ir al paso anterior
  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep, formData);
    }
  }, [currentStep, isFirstStep, formData, onStepChange]);

  // Completar wizard
  const handleComplete = useCallback(async () => {
    if (isSubmitting) return;

    if (!validateCurrentStep()) return;

    setIsSubmitting(true);
    try {
      await onComplete?.(formData);
    } catch (error) {
      modalLog.error('Error completing wizard:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onComplete, isSubmitting, validateCurrentStep]);

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {/* Indicador de pasos */}
        <div className="flex justify-between items-center mb-8 relative">
          {/* Línea de progreso */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-700"></div>

          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative bg-white dark:bg-gray-900 px-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${index < currentStep
                    ? 'bg-green-500 border-green-500 text-black'
                    : index === currentStep
                      ? 'bg-primary-500 border-primary-500 text-black'
                      : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                  }`}
              >
                <span
                  style={{
                    textShadow:
                      '1px 0 0 #fff, -1px 0 0 #fff, 0 1px 0 #fff, 0 -1px 0 #fff, 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff',
                  }}
                >
                  {index < currentStep ? '✓' : index + 1}
                </span>
              </div>

              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 text-center max-w-20">
                {step.title}
              </div>
            </div>
          ))}
        </div>

        {/* Contenido del paso actual */}
        {currentStepData && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {currentStepData.title}
              </h3>
              {currentStepData.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {currentStepData.description}
                </p>
              )}
            </div>

            {/* Campos del paso */}
            {currentStepData.fields?.map((field, index) => (
              <div key={field.name || index} className={MODAL_CLASSES.form.group}>
                <label className={MODAL_CLASSES.form.label}>
                  {field.label}
                  {field.required && <span className={MODAL_CLASSES.form.required}>*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    rows={field.rows || 3}
                    className={`${MODAL_CLASSES.form.input} ${stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                      }`}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    className={`${MODAL_CLASSES.form.input} ${stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                      }`}
                  >
                    <option value="">{field.placeholder || `Seleccionar ${field.label}`}</option>
                    {field.options?.map((option, idx) => (
                      <option key={idx} value={option.value || option}>
                        {option.label || option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className={`${MODAL_CLASSES.form.input} ${stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                      }`}
                  />
                )}

                {stepErrors[field.name] && (
                  <p className={MODAL_CLASSES.form.error}>
                    {stepErrors[field.name]}
                  </p>
                )}
              </div>
            ))}

            {/* Contenido personalizado del paso */}
            {currentStepData.content && (
              <div className="mt-4">
                {currentStepData.content}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-between w-full">
          {/* Botón anterior */}
          <div>
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary} flex items-center`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {buttons?.previous || 'Anterior'}
              </button>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              {buttons?.cancel || 'Cancelar'}
            </button>

            {isLastStep ? (
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.success} flex items-center`}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? 'Finalizando...' : (buttons?.complete || 'Finalizar')}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
              >
                {buttons?.next || 'Siguiente'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const WizardModal_v2 = ({
  type = 'wizard',
  title,
  steps = [],
  data = {},
  buttons,
  validation = {},
  onClose,
  onComplete,
  onStepChange
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(data);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState({});

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const isSummaryStep = currentStepData?.type === 'summary';

  // Manejar cambios en los campos
  const handleInputChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    // Limpiar error del campo
    if (stepErrors[name]) {
      setStepErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [stepErrors]);

  // Validar paso actual
  const validateCurrentStep = useCallback(() => {
    // Los pasos de tipo summary no requieren validación
    if (isSummaryStep) return true;
    
    if (!currentStepData?.fields) return true;

    const errors = {};

    currentStepData.fields.forEach(field => {
      const value = formData[field.name];

      if (field.required && (!value || value.toString().trim() === '')) {
        errors[field.name] = `${field.label} es requerido`;
        return;
      }

      if (validation[field.name] && value) {
        const customError = validation[field.name](value, formData);
        if (customError) {
          errors[field.name] = customError;
        }
      }
    });

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentStepData, formData, validation, isSummaryStep]);

  // Ir al siguiente paso
  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;

    if (isLastStep) {
      handleComplete();
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep, formData);
    }
  }, [currentStep, isLastStep, validateCurrentStep, formData, onStepChange]);

  // Ir al paso anterior
  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep, formData);
    }
  }, [currentStep, isFirstStep, formData, onStepChange]);

  // Completar wizard
  const handleComplete = useCallback(async () => {
    if (isSubmitting) return;

    if (!validateCurrentStep()) return;

    setIsSubmitting(true);
    try {
      await onComplete?.(formData);
    } catch (error) {
      modalLog.error('Error completing wizard:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onComplete, isSubmitting, validateCurrentStep]);

  // Función para renderizar el resumen de datos
  const renderSummary = useCallback(() => {
    const summaryItems = [];
    
    // Recorrer todos los pasos anteriores y extraer los campos con datos
    steps.forEach((step, stepIndex) => {
      if (stepIndex === currentStep) return; // No incluir el paso actual (summary)
      if (step.type === 'summary') return; // No incluir otros pasos summary
      
      const stepData = [];
      step.fields?.forEach(field => {
        const value = formData[field.name];
        if (value !== undefined && value !== null && value !== '') {
          stepData.push({
            label: field.label,
            value: value,
            type: field.type,
            name: field.name
          });
        }
      });
      
      if (stepData.length > 0) {
        summaryItems.push({
          stepTitle: step.title,
          stepDescription: step.description,
          fields: stepData
        });
      }
    });
    
    return (
      <div className="space-y-6">
        {summaryItems.map((item, index) => (
          <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {item.stepTitle}
            </h4>
            {item.stepDescription && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {item.stepDescription}
              </p>
            )}
            <dl className="space-y-2">
              {item.fields.map((field, fieldIndex) => (
                <div key={fieldIndex} className="grid grid-cols-3 gap-4">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {field.label}
                  </dt>
                  <dd className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {field.type === 'file' ? (
                      <span className="inline-flex items-center text-primary-600 dark:text-primary-400">
                        📎 {field.value?.name || 'Archivo adjunto'}
                      </span>
                    ) : field.type === 'textarea' ? (
                      <pre className="whitespace-pre-wrap font-sans text-sm">{field.value}</pre>
                    ) : field.type === 'date' ? (
                      new Date(field.value).toLocaleDateString('es-CL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    ) : field.type === 'time' ? (
                      field.value
                    ) : field.type === 'select' ? (
                      field.value
                    ) : (
                      field.value.toString()
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        
        {summaryItems.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No hay datos para mostrar en el resumen
          </div>
        )}
      </div>
    );
  }, [steps, currentStep, formData]);

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {/* Indicador de pasos */}
        <div className="flex justify-between items-center mb-8 relative">
          {/* Línea de progreso */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-700"></div>

          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative bg-white dark:bg-gray-900 px-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                  index < currentStep
                    ? 'bg-green-500 border-green-500 text-white'
                    : index === currentStep
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>

              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 text-center max-w-20">
                {step.title}
              </div>
            </div>
          ))}
        </div>

        {/* Contenido del paso actual */}
        {currentStepData && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {currentStepData.title}
              </h3>
              {currentStepData.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {currentStepData.description}
                </p>
              )}
            </div>

            {/* Renderizar resumen o campos normales */}
            {isSummaryStep ? (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                {renderSummary()}
              </div>
            ) : (
              <>
                {/* Campos del paso */}
                {currentStepData.fields?.map((field, index) => (
                  <div key={field.name || index} className={MODAL_CLASSES.form.group}>
                    <label className={MODAL_CLASSES.form.label}>
                      {field.label}
                      {field.required && <span className={MODAL_CLASSES.form.required}>*</span>}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        rows={field.rows || 3}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      >
                        <option value="">{field.placeholder || `Seleccionar ${field.label}`}</option>
                        {field.options?.map((option, idx) => (
                          <option key={idx} value={option.value || option}>
                            {option.label || option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'file' ? (
                      <input
                        type="file"
                        onChange={(e) => handleInputChange(field.name, e.target.files[0])}
                        accept={field.accept}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    )}

                    {stepErrors[field.name] && (
                      <p className={MODAL_CLASSES.form.error}>
                        {stepErrors[field.name]}
                      </p>
                    )}
                  </div>
                ))}

                {/* Contenido personalizado del paso */}
                {currentStepData.content && (
                  <div className="mt-4">
                    {currentStepData.content}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-between w-full">
          {/* Botón anterior */}
          <div>
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary} flex items-center`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {buttons?.previous || 'Anterior'}
              </button>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              {buttons?.cancel || 'Cancelar'}
            </button>

            {isLastStep ? (
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.success} flex items-center`}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? 'Finalizando...' : (buttons?.complete || 'Finalizar')}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
              >
                {buttons?.next || 'Siguiente'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const WizardModal_v3 = ({
  type = 'wizard',
  title,
  steps = [],
  data = {},
  buttons,
  validation = {},
  onClose,
  onComplete,
  onStepChange
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(data);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState({});

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const isSummaryStep = currentStepData?.type === 'summary';

  // Manejar cambios en los campos
  const handleInputChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    // Limpiar error del campo
    if (stepErrors[name]) {
      setStepErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [stepErrors]);

  // Validar paso actual
  const validateCurrentStep = useCallback(() => {
    // Los pasos de tipo summary no requieren validación
    if (isSummaryStep) return true;
    
    if (!currentStepData?.fields) return true;

    const errors = {};

    currentStepData.fields.forEach(field => {
      const value = formData[field.name];

      if (field.required && (!value || value.toString().trim() === '')) {
        errors[field.name] = `${field.label} es requerido`;
        return;
      }

      if (validation[field.name] && value) {
        const customError = validation[field.name](value, formData);
        if (customError) {
          errors[field.name] = customError;
        }
      }
    });

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentStepData, formData, validation, isSummaryStep]);

  // Ir al siguiente paso
  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;

    if (isLastStep) {
      handleComplete();
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep, formData);
    }
  }, [currentStep, isLastStep, validateCurrentStep, formData, onStepChange]);

  // Ir al paso anterior
  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep, formData);
    }
  }, [currentStep, isFirstStep, formData, onStepChange]);

  // Completar wizard
  const handleComplete = useCallback(async () => {
    if (isSubmitting) return;

    if (!validateCurrentStep()) return;

    setIsSubmitting(true);
    try {
      await onComplete?.(formData);
    } catch (error) {
      modalLog.error('Error completing wizard:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onComplete, isSubmitting, validateCurrentStep]);

  // Función para renderizar el resumen de datos
  const renderSummary = useCallback(() => {
    const summaryItems = [];
    
    // Recorrer todos los pasos anteriores y extraer TODOS los campos (con o sin datos)
    steps.forEach((step, stepIndex) => {
      if (stepIndex === currentStep) return; // No incluir el paso actual (summary)
      if (step.type === 'summary') return; // No incluir otros pasos summary
      
      const stepData = [];
      step.fields?.forEach(field => {
        const value = formData[field.name];
        const hasValue = value !== undefined && value !== null && value !== '';
        
        stepData.push({
          label: field.label,
          value: value,
          type: field.type,
          name: field.name,
          hasValue: hasValue,
          required: field.required
        });
      });
      
      if (stepData.length > 0) {
        summaryItems.push({
          stepTitle: step.title,
          stepDescription: step.description,
          fields: stepData
        });
      }
    });
    
    return (
      <div className="space-y-6">
        {summaryItems.map((item, index) => (
          <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {item.stepTitle}
            </h4>
            {item.stepDescription && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {item.stepDescription}
              </p>
            )}
            <dl className="space-y-2">
              {item.fields.map((field, fieldIndex) => (
                <div key={fieldIndex} className="grid grid-cols-3 gap-4">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </dt>
                  <dd className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {field.hasValue ? (
                      // Mostrar valor si existe
                      <>
                        {field.type === 'file' ? (
                          <span className="inline-flex items-center text-primary-600 dark:text-primary-400">
                            📎 {field.value?.name || 'Archivo adjunto'}
                          </span>
                        ) : field.type === 'textarea' ? (
                          <pre className="whitespace-pre-wrap font-sans text-sm">{field.value}</pre>
                        ) : field.type === 'date' ? (
                          new Date(field.value).toLocaleDateString('es-CL', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        ) : field.type === 'time' ? (
                          field.value
                        ) : field.type === 'select' ? (
                          field.value
                        ) : (
                          field.value.toString()
                        )}
                      </>
                    ) : (
                      // Mostrar indicador de campo sin valor
                      <span className="inline-flex items-center text-gray-400 dark:text-gray-500 italic">
                        <svg 
                          className="w-4 h-4 mr-1.5" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                          />
                        </svg>
                        {field.required ? 'Campo requerido sin completar' : 'Sin información'}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        
        {summaryItems.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No hay datos para mostrar en el resumen
          </div>
        )}
      </div>
    );
  }, [steps, currentStep, formData]);

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {/* Indicador de pasos */}
        <div className="flex justify-between items-center mb-8 relative">
          {/* Línea de progreso */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-700"></div>

          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative bg-white dark:bg-gray-900 px-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                  index < currentStep
                    ? 'bg-green-500 border-green-500 text-white'
                    : index === currentStep
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>

              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 text-center max-w-20">
                {step.title}
              </div>
            </div>
          ))}
        </div>

        {/* Contenido del paso actual */}
        {currentStepData && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {currentStepData.title}
              </h3>
              {currentStepData.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {currentStepData.description}
                </p>
              )}
            </div>

            {/* Renderizar resumen o campos normales */}
            {isSummaryStep ? (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                {renderSummary()}
              </div>
            ) : (
              <>
                {/* Campos del paso */}
                {currentStepData.fields?.map((field, index) => (
                  <div key={field.name || index} className={MODAL_CLASSES.form.group}>
                    <label className={MODAL_CLASSES.form.label}>
                      {field.label}
                      {field.required && <span className={MODAL_CLASSES.form.required}>*</span>}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        rows={field.rows || 3}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      >
                        <option value="">{field.placeholder || `Seleccionar ${field.label}`}</option>
                        {field.options?.map((option, idx) => (
                          <option key={idx} value={option.value || option}>
                            {option.label || option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'file' ? (
                      <input
                        type="file"
                        onChange={(e) => handleInputChange(field.name, e.target.files[0])}
                        accept={field.accept}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    )}

                    {stepErrors[field.name] && (
                      <p className={MODAL_CLASSES.form.error}>
                        {stepErrors[field.name]}
                      </p>
                    )}
                  </div>
                ))}

                {/* Contenido personalizado del paso */}
                {currentStepData.content && (
                  <div className="mt-4">
                    {currentStepData.content}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-between w-full">
          {/* Botón anterior */}
          <div>
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary} flex items-center`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {buttons?.previous || 'Anterior'}
              </button>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              {buttons?.cancel || 'Cancelar'}
            </button>

            {isLastStep ? (
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.success} flex items-center`}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? 'Finalizando...' : (buttons?.complete || 'Finalizar')}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
              >
                {buttons?.next || 'Siguiente'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const WizardModal_v4 = ({
  type = 'wizard',
  title,
  steps = [],
  data = {},
  buttons,
  validation = {},
  onClose,
  onComplete,
  onStepChange
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(data);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState({});

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const isSummaryStep = currentStepData?.type === 'summary';

  // Manejar cambios en los campos
  const handleInputChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    // Limpiar error del campo
    if (stepErrors[name]) {
      setStepErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [stepErrors]);

  // Validar paso actual
  const validateCurrentStep = useCallback(() => {
    // Los pasos de tipo summary no requieren validación
    if (isSummaryStep) return true;
    
    if (!currentStepData?.fields) return true;

    const errors = {};

    currentStepData.fields.forEach(field => {
      const value = formData[field.name];

      if (field.required && (!value || value.toString().trim() === '')) {
        errors[field.name] = `${field.label} es requerido`;
        return;
      }

      if (validation[field.name] && value) {
        const customError = validation[field.name](value, formData);
        if (customError) {
          errors[field.name] = customError;
        }
      }
    });

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentStepData, formData, validation, isSummaryStep]);

  // Ir al siguiente paso
  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;

    if (isLastStep) {
      handleComplete();
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep, formData);
    }
  }, [currentStep, isLastStep, validateCurrentStep, formData, onStepChange]);

  // Ir al paso anterior
  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep, formData);
    }
  }, [currentStep, isFirstStep, formData, onStepChange]);

// Completar wizard
const handleComplete = useCallback(async () => {
  if (isSubmitting) return;

  if (!validateCurrentStep()) return;

  setIsSubmitting(true);
  try {
    // Crear objeto con TODOS los campos de todos los pasos
    const completeData = {};
    
    steps.forEach((step) => {
      if (step.type === 'summary') return; // Ignorar pasos de tipo summary
      
      step.fields?.forEach((field) => {
        // Incluir el campo con su valor o null/undefined si no tiene valor
        completeData[field.name] = formData[field.name] !== undefined 
          ? formData[field.name] 
          : (field.type === 'file' ? null : '');
      });
    });
    
    await onComplete?.(completeData);
  } catch (error) {
    modalLog.error('Error completing wizard:', error);
  } finally {
    setIsSubmitting(false);
  }
}, [formData, onComplete, isSubmitting, validateCurrentStep, steps]);

  // Función para renderizar el resumen de datos
  const renderSummary = useCallback(() => {
    const summaryItems = [];
    
    // Recorrer todos los pasos anteriores y extraer TODOS los campos (con o sin datos)
    steps.forEach((step, stepIndex) => {
      if (stepIndex === currentStep) return; // No incluir el paso actual (summary)
      if (step.type === 'summary') return; // No incluir otros pasos summary
      
      const stepData = [];
      step.fields?.forEach(field => {
        const value = formData[field.name];
        const hasValue = value !== undefined && value !== null && value !== '';
        
        stepData.push({
          label: field.label,
          value: value,
          type: field.type,
          name: field.name,
          hasValue: hasValue,
          required: field.required
        });
      });
      
      if (stepData.length > 0) {
        summaryItems.push({
          stepTitle: step.title,
          stepDescription: step.description,
          fields: stepData
        });
      }
    });
    
    return (
      <div className="space-y-6">
        {summaryItems.map((item, index) => (
          <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {item.stepTitle}
            </h4>
            {item.stepDescription && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {item.stepDescription}
              </p>
            )}
            <dl className="space-y-2">
              {item.fields.map((field, fieldIndex) => (
                <div key={fieldIndex} className="grid grid-cols-3 gap-4">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </dt>
                  <dd className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {field.hasValue ? (
                      // Mostrar valor si existe
                      <>
                        {field.type === 'file' ? (
                          <span className="inline-flex items-center text-primary-600 dark:text-primary-400">
                            📎 {field.value?.name || 'Archivo adjunto'}
                          </span>
                        ) : field.type === 'textarea' ? (
                          <pre className="whitespace-pre-wrap font-sans text-sm">{field.value}</pre>
                        ) : field.type === 'date' ? (
                          new Date(field.value).toLocaleDateString('es-CL', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        ) : field.type === 'time' ? (
                          field.value
                        ) : field.type === 'select' ? (
                          field.value
                        ) : (
                          field.value.toString()
                        )}
                      </>
                    ) : (
                      // Mostrar indicador de campo sin valor
                      <span className="inline-flex items-center text-gray-400 dark:text-gray-500 italic">
                        <svg 
                          className="w-4 h-4 mr-1.5" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                          />
                        </svg>
                        {field.required ? 'Campo requerido sin completar' : 'Sin información'}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        
        {summaryItems.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No hay datos para mostrar en el resumen
          </div>
        )}
      </div>
    );
  }, [steps, currentStep, formData]);

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {/* Indicador de pasos */}
        <div className="flex justify-between items-center mb-8 relative">
          {/* Línea de progreso */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-700"></div>

          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative bg-white dark:bg-gray-900 px-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                  index < currentStep
                    ? 'bg-green-500 border-green-500 text-white'
                    : index === currentStep
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>

              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 text-center max-w-20">
                {step.title}
              </div>
            </div>
          ))}
        </div>

        {/* Contenido del paso actual */}
        {currentStepData && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {currentStepData.title}
              </h3>
              {currentStepData.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {currentStepData.description}
                </p>
              )}
            </div>

            {/* Renderizar resumen o campos normales */}
            {isSummaryStep ? (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                {renderSummary()}
              </div>
            ) : (
              <>
                {/* Campos del paso */}
                {currentStepData.fields?.map((field, index) => (
                  <div key={field.name || index} className={MODAL_CLASSES.form.group}>
                    <label className={MODAL_CLASSES.form.label}>
                      {field.label}
                      {field.required && <span className={MODAL_CLASSES.form.required}>*</span>}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        rows={field.rows || 3}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      >
                        <option value="">{field.placeholder || `Seleccionar ${field.label}`}</option>
                        {field.options?.map((option, idx) => (
                          <option key={idx} value={option.value || option}>
                            {option.label || option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'file' ? (
                      <input
                        type="file"
                        onChange={(e) => handleInputChange(field.name, e.target.files[0])}
                        accept={field.accept}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    )}

                    {stepErrors[field.name] && (
                      <p className={MODAL_CLASSES.form.error}>
                        {stepErrors[field.name]}
                      </p>
                    )}
                  </div>
                ))}

                {/* Contenido personalizado del paso */}
                {currentStepData.content && (
                  <div className="mt-4">
                    {currentStepData.content}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-between w-full">
          {/* Botón anterior */}
          <div>
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary} flex items-center`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {buttons?.previous || 'Anterior'}
              </button>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              {buttons?.cancel || 'Cancelar'}
            </button>

            {isLastStep ? (
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.success} flex items-center`}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? 'Finalizando...' : (buttons?.complete || 'Finalizar')}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
              >
                {buttons?.next || 'Siguiente'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const WizardModal = ({
  type = 'wizard',
  title,
  steps = [],
  data = {},
  buttons,
  validation = {},
  onClose,
  onComplete,
  onStepChange
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(data);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState({});

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const isSummaryStep = currentStepData?.type === 'summary';

  // Manejar cambios en los campos
  const handleInputChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    // Limpiar error del campo
    if (stepErrors[name]) {
      setStepErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [stepErrors]);

  // Validar paso actual
  const validateCurrentStep = useCallback(() => {
    // Los pasos de tipo summary no requieren validación
    if (isSummaryStep) return true;
    
    if (!currentStepData?.fields) return true;

    const errors = {};

    currentStepData.fields.forEach(field => {
      const value = formData[field.name];

      if (field.required && (!value || value.toString().trim() === '')) {
        errors[field.name] = `${field.label} es requerido`;
        return;
      }

      if (validation[field.name] && value) {
        const customError = validation[field.name](value, formData);
        if (customError) {
          errors[field.name] = customError;
        }
      }
    });

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentStepData, formData, validation, isSummaryStep]);

  // Ir al siguiente paso
  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;

    if (isLastStep) {
      handleComplete();
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep, formData);
    }
  }, [currentStep, isLastStep, validateCurrentStep, formData, onStepChange]);

  // Ir al paso anterior
  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep, formData);
    }
  }, [currentStep, isFirstStep, formData, onStepChange]);

// Completar wizard
const handleComplete = useCallback(async () => {
  if (isSubmitting) return;

  if (!validateCurrentStep()) return;

  setIsSubmitting(true);
  try {
    // Crear objeto organizado por steps
    const completeData = {
      steps: {},
      flatData: {} // También incluir datos planos para compatibilidad
    };
    
    steps.forEach((step, stepIndex) => {
      if (step.type === 'summary') return; // Ignorar pasos de tipo summary
      
      // Crear identificador del step (usar title en snake_case o índice)
      const stepKey = step.title
        .toLowerCase()
        .replace(/[áäâà]/g, 'a')
        .replace(/[éëêè]/g, 'e')
        .replace(/[íïîì]/g, 'i')
        .replace(/[óöôò]/g, 'o')
        .replace(/[úüûù]/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      
      completeData.steps[stepKey] = {
        title: step.title,
        description: step.description,
        stepIndex: stepIndex,
        fields: {}
      };
      
      step.fields?.forEach((field) => {
        const value = formData[field.name] !== undefined 
          ? formData[field.name] 
          : (field.type === 'file' ? null : '');
        
        // Agregar al step
        completeData.steps[stepKey].fields[field.name] = {
          label: field.label,
          value: value,
          type: field.type,
          required: field.required || false
        };
        
        // Agregar a flatData para acceso directo
        completeData.flatData[field.name] = value;
      });
    });
    
    await onComplete?.(completeData);
  } catch (error) {
    modalLog.error('Error completing wizard:', error);
  } finally {
    setIsSubmitting(false);
  }
}, [formData, onComplete, isSubmitting, validateCurrentStep, steps]);
  

  // Función para renderizar el resumen de datos
  const renderSummary = useCallback(() => {
    const summaryItems = [];
    
    // Recorrer todos los pasos anteriores y extraer TODOS los campos (con o sin datos)
    steps.forEach((step, stepIndex) => {
      if (stepIndex === currentStep) return; // No incluir el paso actual (summary)
      if (step.type === 'summary') return; // No incluir otros pasos summary
      
      const stepData = [];
      step.fields?.forEach(field => {
        const value = formData[field.name];
        const hasValue = value !== undefined && value !== null && value !== '';
        
        stepData.push({
          label: field.label,
          value: value,
          type: field.type,
          name: field.name,
          hasValue: hasValue,
          required: field.required
        });
      });
      
      if (stepData.length > 0) {
        summaryItems.push({
          stepTitle: step.title,
          stepDescription: step.description,
          fields: stepData
        });
      }
    });
    
    return (
      <div className="space-y-6">
        {summaryItems.map((item, index) => (
          <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {item.stepTitle}
            </h4>
            {item.stepDescription && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {item.stepDescription}
              </p>
            )}
            <dl className="space-y-2">
              {item.fields.map((field, fieldIndex) => (
                <div key={fieldIndex} className="grid grid-cols-3 gap-4">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </dt>
                  <dd className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {field.hasValue ? (
                      // Mostrar valor si existe
                      <>
                        {field.type === 'file' ? (
                          <span className="inline-flex items-center text-primary-600 dark:text-primary-400">
                            📎 {field.value?.name || 'Archivo adjunto'}
                          </span>
                        ) : field.type === 'textarea' ? (
                          <pre className="whitespace-pre-wrap font-sans text-sm">{field.value}</pre>
                        ) : field.type === 'date' ? (
                          new Date(field.value).toLocaleDateString('es-CL', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        ) : field.type === 'time' ? (
                          field.value
                        ) : field.type === 'select' ? (
                          field.value
                        ) : (
                          field.value.toString()
                        )}
                      </>
                    ) : (
                      // Mostrar indicador de campo sin valor
                      <span className="inline-flex items-center text-gray-400 dark:text-gray-500 italic">
                        <svg 
                          className="w-4 h-4 mr-1.5" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                          />
                        </svg>
                        {field.required ? 'Campo requerido sin completar' : 'Sin información'}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        
        {summaryItems.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No hay datos para mostrar en el resumen
          </div>
        )}
      </div>
    );
  }, [steps, currentStep, formData]);

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {/* Indicador de pasos */}
        <div className="flex justify-between items-center mb-8 relative">
          {/* Línea de progreso */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-700"></div>

          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative bg-white dark:bg-gray-900 px-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                  index < currentStep
                    ? 'bg-green-500 border-green-500 text-white'
                    : index === currentStep
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>

              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 text-center max-w-20">
                {step.title}
              </div>
            </div>
          ))}
        </div>

        {/* Contenido del paso actual */}
        {currentStepData && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {currentStepData.title}
              </h3>
              {currentStepData.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {currentStepData.description}
                </p>
              )}
            </div>

            {/* Renderizar resumen o campos normales */}
            {isSummaryStep ? (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                {renderSummary()}
              </div>
            ) : (
              <>
                {/* Campos del paso */}
                {currentStepData.fields?.map((field, index) => (
                  <div key={field.name || index} className={MODAL_CLASSES.form.group}>
                    <label className={MODAL_CLASSES.form.label}>
                      {field.label}
                      {field.required && <span className={MODAL_CLASSES.form.required}>*</span>}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        rows={field.rows || 3}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      >
                        <option value="">{field.placeholder || `Seleccionar ${field.label}`}</option>
                        {field.options?.map((option, idx) => (
                          <option key={idx} value={option.value || option}>
                            {option.label || option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'file' ? (
                      <input
                        type="file"
                        onChange={(e) => handleInputChange(field.name, e.target.files[0])}
                        accept={field.accept}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className={`${MODAL_CLASSES.form.input} ${
                          stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                        }`}
                      />
                    )}

                    {stepErrors[field.name] && (
                      <p className={MODAL_CLASSES.form.error}>
                        {stepErrors[field.name]}
                      </p>
                    )}
                  </div>
                ))}

                {/* Contenido personalizado del paso */}
                {currentStepData.content && (
                  <div className="mt-4">
                    {currentStepData.content}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-between w-full">
          {/* Botón anterior */}
          <div>
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary} flex items-center`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {buttons?.previous || 'Anterior'}
              </button>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              {buttons?.cancel || 'Cancelar'}
            </button>

            {isLastStep ? (
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.success} flex items-center`}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? 'Finalizando...' : (buttons?.complete || 'Finalizar')}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
              >
                {buttons?.next || 'Siguiente'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE LOGIN
// ====================================

const LoginModal = ({
  type = 'login',
  title,
  message,
  fields = [],
  buttons,
  showRegisterLink = true,
  showForgotPassword = true,
  onClose,
  onSubmit,
  onRegister,
  onForgotPassword
}) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // Campos por defecto si no se proporcionan
  const defaultFields = [
    {
      name: 'username',
      label: 'Usuario o Email',
      type: 'text',
      placeholder: 'usuario@empresa.com',
      required: true
    },
    {
      name: 'password',
      label: 'Contraseña',
      type: 'password',
      placeholder: '••••••••',
      required: true
    }
  ];

  const formFields = fields.length > 0 ? fields : defaultFields;

  const handleInputChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();

    if (isSubmitting) return;

    // Validación básica
    const newErrors = {};
    formFields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} es requerido`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit?.(formData);
    } catch (error) {
      modalLog.error('Error logging in:', error);
      setErrors({ general: 'Error al iniciar sesión. Verifique sus credenciales.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, isSubmitting, formFields]);

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {message && (
          <div className="mb-6 text-gray-600 dark:text-gray-400">
            <p>{message}</p>
          </div>
        )}

        {/* Error general */}
        {errors.general && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {formFields.map((field, index) => (
            <div key={field.name || index} className={MODAL_CLASSES.form.group}>
              <label className={MODAL_CLASSES.form.label}>
                {field.label}
                {field.required && <span className={MODAL_CLASSES.form.required}>*</span>}
              </label>

              <div className="relative">
                <input
                  type={field.name === 'password' ? (showPassword ? 'text' : 'password') : field.type}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  className={`${MODAL_CLASSES.form.input} ${field.name === 'password' ? 'pr-10' : ''
                    } ${errors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''}`}
                />

                {/* Toggle de mostrar/ocultar contraseña */}
                {field.name === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {errors[field.name] && (
                <p className={MODAL_CLASSES.form.error}>
                  {errors[field.name]}
                </p>
              )}
            </div>
          ))}

          {/* Recordarme y Olvidé contraseña */}
          <div className="flex items-center justify-between py-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Recordarme</span>
            </label>

            {showForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
        </form>

        {/* Link de registro */}
        {showRegisterLink && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              ¿No tienes cuenta?{' '}
              <button
                onClick={onRegister}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-500 font-medium"
              >
                Regístrate aquí
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className={MODAL_CLASSES.footerButtons}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
          >
            {buttons?.cancel || 'Cancelar'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSubmitting ? 'Iniciando...' : (buttons?.submit || 'Iniciar Sesión')}
          </button>
        </div>
      </div>
    </>
  );
};

// ====================================
// FUNCIONES RENDER (WRAPPERAS)
// ====================================

export const renderConfirmModal = (props) => <ConfirmModal {...props} />;
export const renderFormModal = (props) => <FormModal {...props} />;
export const renderWizardModal = (props) => <WizardModal {...props} />;
export const renderLoginModal = (props) => <LoginModal {...props} />;

// ====================================
// MAPEO DE FUNCIONES RENDER
// ====================================

export const interactiveModalRenderers = {
  confirm: renderConfirmModal,
  form: renderFormModal,
  wizard: renderWizardModal,
  login: renderLoginModal
};

// ====================================
// EXPORT POR DEFECTO
// ====================================

export default interactiveModalRenderers;