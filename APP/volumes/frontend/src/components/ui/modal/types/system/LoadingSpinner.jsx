/**
 * types/system/LoadingSpinner.jsx
 * Componente de loading con progreso, pasos y estados
 * Spinners personalizables, barras de progreso, indicadores
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Loader2, CheckCircle, AlertCircle, Clock, Zap, 
  Download, Upload, RefreshCcwDot, Cpu, Database
} from 'lucide-react';

// ====================================
// TIPOS DE SPINNER
// ====================================

const SpinnerTypes = {
  default: Loader2,
  download: Download,
  upload: Upload,
  refresh: RefreshCcwDot,
  processing: Cpu,
  database: Database,
  check: CheckCircle,
  alert: AlertCircle,
  clock: Clock,
  zap: Zap
};

// ====================================
// COMPONENTE PRINCIPAL
// ====================================

export const LoadingSpinner = ({
  message = 'Cargando...',
  progress = 0,
  showProgress = false,
  indeterminate = true,
  steps = [],
  currentStep = 0,
  variant = 'default', // default, success, warning, error, info
  size = 'medium', // small, medium, large
  spinnerType = 'default',
  showPercentage = true, //<-- Esta es la linea 44
  showETA = false,
  estimatedTime = 0,
  speed = null,
  onCancel
}) => {
  // ====================================
  // ESTADO LOCAL
  // ====================================
  
  const [currentProgress, setCurrentProgress] = useState(progress);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [eta, setETA] = useState(0);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  // ====================================
  // CONFIGURACIÓN POR VARIANTE
  // ====================================
  
  const variants = {
    default: {
      spinner: 'text-primary-600',
      text: 'text-gray-600 dark:text-gray-300',
      progress: 'bg-primary-600',
      bg: 'bg-primary-50 dark:bg-primary-900/20'
    },
    success: {
      spinner: 'text-green-600',
      text: 'text-green-700 dark:text-green-300',
      progress: 'bg-green-600',
      bg: 'bg-green-50 dark:bg-green-900/20'
    },
    warning: {
      spinner: 'text-yellow-600',
      text: 'text-yellow-700 dark:text-yellow-300',
      progress: 'bg-yellow-600',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20'
    },
    error: {
      spinner: 'text-red-600',
      text: 'text-red-700 dark:text-red-300',
      progress: 'bg-red-600',
      bg: 'bg-red-50 dark:bg-red-900/20'
    },
    info: {
      spinner: 'text-blue-600',
      text: 'text-blue-700 dark:text-blue-300',
      progress: 'bg-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-900/20'
    }
  };
  
  const sizes = {
    small: { spinner: 'w-4 h-4', text: 'text-sm' },
    medium: { spinner: 'w-6 h-6', text: 'text-base' },
    large: { spinner: 'w-8 h-8', text: 'text-lg' }
  };
  
  const currentVariant = variants[variant] || variants.default;
  const currentSize = sizes[size] || sizes.medium;
  const SpinnerIcon = SpinnerTypes[spinnerType] || SpinnerTypes.default;
  
  // ====================================
  // EFECTOS
  // ====================================
  
  // Actualizar progreso
  useEffect(() => {
    setCurrentProgress(progress);
  }, [progress]);
  
  // Animar progreso
  useEffect(() => {
    if (showProgress && !indeterminate) {
      const timer = setTimeout(() => {
        setAnimatedProgress(currentProgress);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentProgress, showProgress, indeterminate]);
  
  // Calcular tiempo transcurrido y ETA
  useEffect(() => {
    if (!showETA) return;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);
      
      if (currentProgress > 0 && currentProgress < 100) {
        const remainingProgress = 100 - currentProgress;
        const timePerPercent = elapsed / currentProgress;
        const estimatedRemaining = remainingProgress * timePerPercent;
        setETA(estimatedRemaining);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, currentProgress, showETA]);
  
  // ====================================
  // UTILIDADES
  // ====================================
  
  const formatTime = useCallback((ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }, []);
  
  const formatSpeed = useCallback((bytesPerSecond) => {
    if (!bytesPerSecond) return '';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let speed = bytesPerSecond;
    let unitIndex = 0;
    
    while (speed >= 1024 && unitIndex < units.length - 1) {
      speed /= 1024;
      unitIndex++;
    }
    
    return `${speed.toFixed(1)} ${units[unitIndex]}`;
  }, []);
  
  // ====================================
  // RENDER HELPERS
  // ====================================
  
  const renderSpinner = () => (
    <div className="flex items-center justify-center mb-4">
      <SpinnerIcon 
        className={`${currentSize.spinner} ${currentVariant.spinner} animate-spin`}
      />
    </div>
  );
  
  const renderPulsingDots = () => (
    <div className="flex items-center justify-center mb-4">
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 ${currentVariant.progress} rounded-full animate-pulse`}
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
  
  const renderProgressBar = () => showProgress && !indeterminate && (
    <div className="mb-4">
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div 
          className={`h-full ${currentVariant.progress} transition-all duration-500 ease-out relative`}
          style={{ width: `${Math.min(animatedProgress, 100)}%` }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        </div>
      </div>
      
      {showPercentage && (
        <div className="flex justify-between items-center mt-2 text-sm">
          <span className={currentVariant.text}>
            {Math.round(currentProgress)}%
          </span>
          {showETA && eta > 0 && (
            <span className="text-gray-500 dark:text-gray-400">
              ETA: {formatTime(eta)}
            </span>
          )}
        </div>
      )}
    </div>
  );
  
  const renderIndeterminateBar = () => showProgress && indeterminate && (
    <div className="mb-4">
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div className={`h-full ${currentVariant.progress} w-1/3 animate-pulse`} 
             style={{ 
               animation: 'slide 2s infinite linear',
               backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)'
             }} />
      </div>
    </div>
  );
  
  const renderSteps = () => steps.length > 0 && (
    <div className="mb-4">
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center text-sm">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 transition-all ${
              index < currentStep 
                ? `${currentVariant.progress} text-white`
                : index === currentStep
                ? `border-2 ${currentVariant.progress.replace('bg-', 'border-')} ${currentVariant.spinner}`
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
            }`}>
              {index < currentStep ? (
                <CheckCircle className="w-4 h-4" />
              ) : index === currentStep ? (
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
              ) : (
                <span className="text-xs">{index + 1}</span>
              )}
            </div>
            <span className={
              index <= currentStep 
                ? `${currentVariant.text} font-medium`
                : 'text-gray-500 dark:text-gray-400'
            }>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
  
  const renderMessage = () => (
    <div className="text-center mb-2">
      <p className={`${currentSize.text} ${currentVariant.text} font-medium`}>
        {message}
      </p>
    </div>
  );
  
  const renderStats = () => (speed || showETA) && (
    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mt-2">
      {speed && (
        <span>Velocidad: {formatSpeed(speed)}</span>
      )}
      {showETA && elapsedTime > 0 && (
        <span>Transcurrido: {formatTime(elapsedTime)}</span>
      )}
    </div>
  );
  
  const renderCancelButton = () => onCancel && (
    <div className="text-center mt-4">
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
      >
        Cancelar
      </button>
    </div>
  );
  
  // ====================================
  // COMPONENTES ESPECIALIZADOS
  // ====================================
  
  const renderSkeletonLoader = () => (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  
  const renderMinimalSpinner = () => (
    <div className="inline-flex items-center">
      <SpinnerIcon className={`${currentSize.spinner} ${currentVariant.spinner} animate-spin mr-2`} />
      <span className={`${currentSize.text} ${currentVariant.text}`}>
        {message}
      </span>
    </div>
  );
  
  // ====================================
  // RENDER PRINCIPAL
  // ====================================
  
  // Variantes especiales
  if (variant === 'skeleton') {
    return renderSkeletonLoader();
  }
  
  if (variant === 'minimal') {
    return renderMinimalSpinner();
  }
  
  if (variant === 'dots') {
    return (
      <div className="text-center py-4">
        {renderPulsingDots()}
        {renderMessage()}
      </div>
    );
  }
  
  // Render estándar
  return (
    <div className="text-center py-6">
      {/* Spinner principal */}
      {renderSpinner()}
      
      {/* Mensaje */}
      {renderMessage()}
      
      {/* Pasos */}
      {renderSteps()}
      
      {/* Progreso */}
      {indeterminate ? renderIndeterminateBar() : renderProgressBar()}
      
      {/* Estadísticas */}
      {renderStats()}
      
      {/* Botón cancelar */}
      {renderCancelButton()}
      
      {/* Estilos adicionales para animaciones */}
      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

// ====================================
// COMPONENTES AUXILIARES
// ====================================

/**
 * Spinner simple para uso inline
 */
export const InlineSpinner = ({ size = 'small', variant = 'default' }) => (
  <LoadingSpinner 
    variant="minimal" 
    size={size} 
    message="" 
    spinnerType={variant}
  />
);

/**
 * Skeleton loader para contenido
 */
export const SkeletonLoader = ({ lines = 3 }) => (
  <div className="space-y-3">
    {[...Array(lines)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      </div>
    ))}
  </div>
);

/**
 * Overlay de loading para cubrir contenido
 */
export const LoadingOverlay = ({ isVisible, children, ...props }) => (
  <div className="relative">
    {children}
    {isVisible && (
      <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-10">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <LoadingSpinner {...props} />
        </div>
      </div>
    )}
  </div>
);

export default LoadingSpinner;