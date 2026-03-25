/**
 * types/system/SettingsPanel.jsx
 * Panel de configuración completo con categorías
 * Diferentes tipos de controles y validación
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Settings, User, Lock, Bell, Palette, Globe, Monitor, 
  Smartphone, Shield, Eye, EyeOff, Save, RotateCcw,
  Check, X, AlertTriangle, Info, ChevronRight
} from 'lucide-react';

import logger from '@/utils/logger';
const modalLog = logger.scope("modal");

// ====================================
// ICONOS POR CATEGORÍA
// ====================================

const CategoryIcons = {
  general: Settings,
  account: User,
  security: Lock,
  notifications: Bell,
  appearance: Palette,
  language: Globe,
  privacy: Eye,
  advanced: Monitor,
  mobile: Smartphone,
  admin: Shield
};

// ====================================
// TIPOS DE CONTROLES
// ====================================

const ControlTypes = {
  toggle: 'toggle',
  select: 'select',
  input: 'input',
  textarea: 'textarea',
  slider: 'slider',
  color: 'color',
  file: 'file',
  radio: 'radio',
  checkbox: 'checkbox',
  number: 'number',
  password: 'password'
};

// ====================================
// COMPONENTE PRINCIPAL
// ====================================

export const SettingsPanel = ({
  categories = [],
  activeCategory = 'general',
  settings = {},
  defaultSettings = {},
  onCategoryChange,
  onSettingChange,
  onSave,
  onReset,
  showSaveButton = true,
  showResetButton = true,
  autoSave = false,
  validation = {}
}) => {
  // ====================================
  // ESTADO LOCAL
  // ====================================
  
  const [currentCategory, setCurrentCategory] = useState(activeCategory);
  const [currentSettings, setCurrentSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedSettings, setSavedSettings] = useState(settings);
  
  // ====================================
  // CONFIGURACIÓN POR DEFECTO
  // ====================================
  
  const defaultCategories = [
    {
      id: 'general',
      name: 'General',
      icon: 'general',
      settings: [
        {
          id: 'language',
          label: 'Idioma',
          type: 'select',
          options: [
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'Français' }
          ],
          defaultValue: 'es'
        },
        {
          id: 'timezone',
          label: 'Zona horaria',
          type: 'select',
          options: [
            { value: 'America/Santiago', label: 'Santiago (UTC-3)' },
            { value: 'America/Lima', label: 'Lima (UTC-5)' },
            { value: 'Europe/Madrid', label: 'Madrid (UTC+1)' }
          ],
          defaultValue: 'America/Santiago'
        },
        {
          id: 'autoSave',
          label: 'Guardado automático',
          type: 'toggle',
          description: 'Guardar cambios automáticamente',
          defaultValue: true
        }
      ]
    },
    {
      id: 'appearance',
      name: 'Apariencia',
      icon: 'appearance',
      settings: [
        {
          id: 'theme',
          label: 'Tema',
          type: 'radio',
          options: [
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Oscuro' },
            { value: 'system', label: 'Sistema' }
          ],
          defaultValue: 'system'
        },
        {
          id: 'primaryColor',
          label: 'Color principal',
          type: 'color',
          defaultValue: '#3b82f6'
        },
        {
          id: 'fontSize',
          label: 'Tamaño de fuente',
          type: 'slider',
          min: 12,
          max: 20,
          step: 1,
          defaultValue: 14,
          unit: 'px'
        }
      ]
    }
  ];
  
  const finalCategories = categories.length > 0 ? categories : defaultCategories;
  
  // ====================================
  // EFECTOS
  // ====================================
  
  useEffect(() => {
    setCurrentSettings(settings);
    setSavedSettings(settings);
  }, [settings]);
  
  useEffect(() => {
    setCurrentCategory(activeCategory);
  }, [activeCategory]);
  
  useEffect(() => {
    const changed = JSON.stringify(currentSettings) !== JSON.stringify(savedSettings);
    setHasChanges(changed);
  }, [currentSettings, savedSettings]);
  
  // Auto-save
  useEffect(() => {
    if (autoSave && hasChanges) {
      const timer = setTimeout(() => {
        handleSave();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [autoSave, hasChanges, currentSettings]);
  
  // ====================================
  // HANDLERS
  // ====================================
  
  const handleCategoryChange = useCallback((categoryId) => {
    setCurrentCategory(categoryId);
    onCategoryChange?.(categoryId);
  }, [onCategoryChange]);
  
  const handleSettingChange = useCallback((settingId, value) => {
    const newSettings = { ...currentSettings, [settingId]: value };
    setCurrentSettings(newSettings);
    
    // Limpiar error si existe
    if (errors[settingId]) {
      setErrors(prev => ({ ...prev, [settingId]: null }));
    }
    
    onSettingChange?.(settingId, value, newSettings);
  }, [currentSettings, errors, onSettingChange]);
  
  const validateSettings = useCallback(() => {
    const newErrors = {};
    
    finalCategories.forEach(category => {
      category.settings?.forEach(setting => {
        const value = currentSettings[setting.id];
        const validator = validation[setting.id];
        
        // Validación requerida
        if (setting.required && (value === undefined || value === null || value === '')) {
          newErrors[setting.id] = `${setting.label} es requerido`;
          return;
        }
        
        // Validación personalizada
        if (validator && value !== undefined) {
          const error = validator(value, currentSettings);
          if (error) {
            newErrors[setting.id] = error;
          }
        }
        
        // Validaciones por tipo
        if (value && setting.type === 'number') {
          if (setting.min !== undefined && value < setting.min) {
            newErrors[setting.id] = `Valor mínimo: ${setting.min}`;
          }
          if (setting.max !== undefined && value > setting.max) {
            newErrors[setting.id] = `Valor máximo: ${setting.max}`;
          }
        }
      });
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentSettings, validation, finalCategories]);
  
  const handleSave = useCallback(async () => {
    if (!validateSettings()) return;
    
    setIsSaving(true);
    try {
      await onSave?.(currentSettings);
      setSavedSettings(currentSettings);
      setHasChanges(false);
    } catch (error) {
      modalLog.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [currentSettings, validateSettings, onSave]);
  
  const handleReset = useCallback(() => {
    const resetSettings = { ...defaultSettings };
    setCurrentSettings(resetSettings);
    setErrors({});
    onReset?.(resetSettings);
  }, [defaultSettings, onReset]);
  
  // ====================================
  // RENDER HELPERS
  // ====================================
  
  const renderControl = useCallback((setting) => {
    const value = currentSettings[setting.id] ?? setting.defaultValue;
    const hasError = !!errors[setting.id];
    
    const baseInputClasses = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
      hasError 
        ? 'border-red-300 dark:border-red-600 focus:border-red-500' 
        : 'border-gray-300 dark:border-gray-600 focus:border-primary-500'
    } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`;
    
    switch (setting.type) {
      case ControlTypes.toggle:
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleSettingChange(setting.id, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
          </label>
        );
      
      case ControlTypes.select:
        return (
          <select
            value={value || ''}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            className={baseInputClasses}
          >
            {setting.placeholder && (
              <option value="">{setting.placeholder}</option>
            )}
            {setting.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      case ControlTypes.radio:
        return (
          <div className="space-y-2">
            {setting.options?.map((option) => (
              <label key={option.value} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name={setting.id}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => handleSettingChange(setting.id, e.target.value)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        );
      
      case ControlTypes.slider:
        return (
          <div className="space-y-2">
            <input
              type="range"
              min={setting.min || 0}
              max={setting.max || 100}
              step={setting.step || 1}
              value={value || setting.defaultValue}
              onChange={(e) => handleSettingChange(setting.id, parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{setting.min || 0}{setting.unit}</span>
              <span className="font-medium">{value || setting.defaultValue}{setting.unit}</span>
              <span>{setting.max || 100}{setting.unit}</span>
            </div>
          </div>
        );
      
      case ControlTypes.color:
        return (
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={value || setting.defaultValue}
              onChange={(e) => handleSettingChange(setting.id, e.target.value)}
              className="w-12 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
            />
            <input
              type="text"
              value={value || setting.defaultValue}
              onChange={(e) => handleSettingChange(setting.id, e.target.value)}
              className={`${baseInputClasses} flex-1 font-mono text-sm`}
              placeholder="#000000"
            />
          </div>
        );
      
      case ControlTypes.textarea:
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            placeholder={setting.placeholder}
            rows={setting.rows || 3}
            className={baseInputClasses}
          />
        );
      
      case ControlTypes.number:
        return (
          <input
            type="number"
            value={value || ''}
            min={setting.min}
            max={setting.max}
            step={setting.step}
            onChange={(e) => handleSettingChange(setting.id, parseFloat(e.target.value))}
            placeholder={setting.placeholder}
            className={baseInputClasses}
          />
        );
      
      case ControlTypes.password:
        return (
          <div className="relative">
            <input
              type="password"
              value={value || ''}
              onChange={(e) => handleSettingChange(setting.id, e.target.value)}
              placeholder={setting.placeholder}
              className={`${baseInputClasses} pr-10`}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        );
      
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            placeholder={setting.placeholder}
            className={baseInputClasses}
          />
        );
    }
  }, [currentSettings, errors, handleSettingChange]);
  
  const renderSetting = useCallback((setting) => (
    <div key={setting.id} className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {setting.label}
            {setting.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {setting.description && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {setting.description}
            </p>
          )}
        </div>
        {setting.type !== ControlTypes.toggle && (
          <div className="ml-4 flex-shrink-0 w-64">
            {renderControl(setting)}
          </div>
        )}
        {setting.type === ControlTypes.toggle && (
          <div className="ml-4 flex-shrink-0">
            {renderControl(setting)}
          </div>
        )}
      </div>
      
      {errors[setting.id] && (
        <div className="flex items-center text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 mr-1" />
          {errors[setting.id]}
        </div>
      )}
      
      {setting.help && (
        <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
          <Info className="w-3 h-3 mr-1" />
          {setting.help}
        </div>
      )}
    </div>
  ), [renderControl, errors]);
  
  const renderCategoryNav = () => (
    <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4">
      <div className="space-y-1">
        {finalCategories.map((category) => {
          const IconComponent = CategoryIcons[category.icon] || Settings;
          const isActive = category.id === currentCategory;
          
          return (
            <button
              key={category.id}
              onClick={() => handleCategoryChange(category.id)}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <IconComponent className="w-4 h-4 mr-3" />
              {category.name}
              <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${isActive ? 'rotate-90' : ''}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
  
  const renderCategoryContent = () => {
    const category = finalCategories.find(cat => cat.id === currentCategory);
    if (!category) return null;
    
    return (
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {category.name}
          </h2>
          {category.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {category.description}
            </p>
          )}
        </div>
        
        <div className="space-y-6">
          {category.settings?.map(renderSetting)}
        </div>
      </div>
    );
  };
  
  const renderActions = () => (showSaveButton || showResetButton) && (
    <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm">
          {hasChanges && (
            <>
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">
                Cambios sin guardar
              </span>
            </>
          )}
          {!hasChanges && savedSettings && (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400">
                Configuración guardada
              </span>
            </>
          )}
        </div>
        
        <div className="flex space-x-3">
          {showResetButton && (
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restablecer
            </button>
          )}
          
          {showSaveButton && (
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving || Object.keys(errors).length > 0}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar cambios
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
  
  // ====================================
  // RENDER PRINCIPAL
  // ====================================
  
  return (
    <div className="flex h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Navegación de categorías */}
      {renderCategoryNav()}
      
      <div className="flex-1 flex flex-col">
        {/* Contenido de la categoría */}
        {renderCategoryContent()}
        
        {/* Acciones */}
        {renderActions()}
      </div>
    </div>
  );
};

export default SettingsPanel;