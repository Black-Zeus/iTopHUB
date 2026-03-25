/**
 * components/ui/PageLoadingSpinner.jsx
 * Spinner estándar para cargas de página completa
 * Usa LoadingSpinner internamente con configuración centralizada
 */

import React from 'react';
import { LoadingSpinner } from '@/components/ui/modal/types/system/LoadingSpinner';

// Configuración por defecto (puede ser sobrescrita por .env)
const DEFAULT_CONFIG = {
  variant: 'default',
  size: 'large',
  spinnerType: 'default',
  showProgress: false,
  indeterminate: true
};

// Leer configuración desde variables de entorno
const getSpinnerConfig = () => {
  return {
    variant: import.meta.env.VITE_PAGE_SPINNER_VARIANT || DEFAULT_CONFIG.variant,
    size: import.meta.env.VITE_PAGE_SPINNER_SIZE || DEFAULT_CONFIG.size,
    spinnerType: import.meta.env.VITE_PAGE_SPINNER_TYPE || DEFAULT_CONFIG.spinnerType,
    showProgress: import.meta.env.VITE_PAGE_SPINNER_SHOW_PROGRESS === 'true' || DEFAULT_CONFIG.showProgress,
    indeterminate: import.meta.env.VITE_PAGE_SPINNER_INDETERMINATE !== 'false' // true por defecto
  };
};

const PageLoadingSpinner = ({ 
  message = 'Cargando...',
  variant,
  size,
  spinnerType,
  showProgress,
  indeterminate,
  ...props
}) => {
  // Obtener configuración desde .env
  const envConfig = getSpinnerConfig();
  
  // Merge: props específicos > .env > defaults
  const finalConfig = {
    variant: variant || envConfig.variant,
    size: size || envConfig.size,
    spinnerType: spinnerType || envConfig.spinnerType,
    showProgress: showProgress !== undefined ? showProgress : envConfig.showProgress,
    indeterminate: indeterminate !== undefined ? indeterminate : envConfig.indeterminate
  };

  return (
    <div className="flex items-center justify-center min-h-screen  dark:">
      <div className="text-center">
        <LoadingSpinner 
          message={message}
          variant={finalConfig.variant}
          size={finalConfig.size}
          spinnerType={finalConfig.spinnerType}
          showProgress={finalConfig.showProgress}
          indeterminate={finalConfig.indeterminate}
          {...props}
        />
      </div>
    </div>
  );
};

export default PageLoadingSpinner;