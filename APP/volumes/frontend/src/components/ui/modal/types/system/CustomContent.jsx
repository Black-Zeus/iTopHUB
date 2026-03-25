/**
 * types/system/CustomContent.jsx
 * Componente para contenido personalizable en modales
 * Plantillas reutilizables, layouts flexibles, componentes modulares
 */

import React, { useState, useCallback } from 'react';
import { 
  Sparkles, Zap, Shield, Smartphone, Globe, Palette,
  Code, Users, Star, TrendingUp, CheckCircle, ArrowRight,
  Play, Download, ExternalLink, Copy, Share2, Heart
} from 'lucide-react';

// ====================================
// COMPONENTES AUXILIARES
// ====================================

const FeatureCard = ({ icon: Icon, title, description, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/30 dark:text-blue-200',
    green: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/30 dark:text-green-200',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800/30 dark:text-yellow-200',
    purple: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/20 dark:border-purple-800/30 dark:text-purple-200',
    red: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-200'
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[color] || colors.blue} transition-all hover:shadow-md`}>
      <div className="flex items-center mb-3">
        <Icon className="w-6 h-6 mr-3" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm opacity-90 leading-relaxed">{description}</p>
    </div>
  );
};

const StatCard = ({ value, label, icon: Icon, trend, color = 'primary' }) => {
  const colors = {
    primary: 'text-primary-600 dark:text-primary-400',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400'
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${colors[color]}`} />
        {trend && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            trend > 0 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        {value}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {label}
      </div>
    </div>
  );
};

// ====================================
// COMPONENTE PRINCIPAL
// ====================================

export const CustomContent = ({
  variant = 'default',
  title = 'Contenido Personalizado',
  subtitle,
  description,
  features = [],
  stats = [],
  cards = [],
  actions = [],
  media = null,
  testimonial = null,
  pricing = null,
  timeline = [],
  faq = [],
  children,
  className = '',
  onAction
}) => {
  // ====================================
  // ESTADO LOCAL
  // ====================================
  
  const [activeTab, setActiveTab] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [copiedText, setCopiedText] = useState(false);
  
  // ====================================
  // HANDLERS
  // ====================================
  
  const handleAction = useCallback((action, data) => {
    onAction?.(action, data);
  }, [onAction]);
  
  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    });
  }, []);
  
  // ====================================
  // VARIANTES PREDEFINIDAS
  // ====================================
  
  if (variant === 'welcome') {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {title || '¡Bienvenido!'}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
          {description || 'Nos alegra tenerte aquí. Estás a punto de descubrir todas las funcionalidades increíbles que hemos preparado para ti.'}
        </p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => handleAction('get-started')}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors flex items-center"
          >
            Comenzar
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
          <button
            onClick={() => handleAction('learn-more')}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Aprender más
          </button>
        </div>
      </div>
    );
  }
  
  if (variant === 'features') {
    const defaultFeatures = [
      { icon: Zap, title: 'Rápido y Eficiente', description: 'Diseñado para máximo rendimiento', color: 'yellow' },
      { icon: Shield, title: 'Seguro', description: 'Protección de datos de nivel empresarial', color: 'green' },
      { icon: Smartphone, title: 'Responsive', description: 'Funciona perfectamente en todos los dispositivos', color: 'blue' }
    ];
    
    const displayFeatures = features.length > 0 ? features : defaultFeatures;
    
    return (
      <div className={`py-6 ${className}`}>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {title || 'Características Destacadas'}
          </h2>
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayFeatures.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    );
  }
  
  if (variant === 'stats') {
    const defaultStats = [
      { value: '10K+', label: 'Usuarios activos', icon: Users, trend: 12, color: 'primary' },
      { value: '99.9%', label: 'Tiempo de actividad', icon: TrendingUp, trend: 0.2, color: 'green' },
      { value: '4.9', label: 'Valoración promedio', icon: Star, color: 'yellow' }
    ];
    
    const displayStats = stats.length > 0 ? stats : defaultStats;
    
    return (
      <div className={`py-6 ${className}`}>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {title || 'Números que Hablan'}
          </h2>
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayStats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>
    );
  }
  
  if (variant === 'pricing') {
    return (
      <div className={`py-6 ${className}`}>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {title || 'Planes y Precios'}
          </h2>
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        
        {pricing && (
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pricing.plans?.map((plan, index) => (
                <div key={index} className={`relative p-6 bg-white dark:bg-gray-800 rounded-xl border-2 transition-all hover:shadow-lg ${
                  plan.popular 
                    ? 'border-primary-500 shadow-lg' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Más Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {plan.name}
                    </h3>
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      ${plan.price}
                      <span className="text-lg font-normal text-gray-500 dark:text-gray-400">
                        /{plan.period || 'mes'}
                      </span>
                    </div>
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features?.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-center text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={() => handleAction('select-plan', plan)}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      plan.popular
                        ? 'bg-primary-600 hover:bg-primary-700 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {plan.buttonText || 'Seleccionar Plan'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  if (variant === 'faq') {
    const defaultFaq = [
      {
        question: '¿Cómo puedo comenzar?',
        answer: 'Es muy sencillo. Solo necesitas crear una cuenta y seguir el asistente de configuración inicial.'
      },
      {
        question: '¿Hay una versión gratuita?',
        answer: 'Sí, ofrecemos un plan gratuito con funcionalidades básicas que puedes usar indefinidamente.'
      },
      {
        question: '¿Puedo cancelar en cualquier momento?',
        answer: 'Por supuesto. No hay compromisos a largo plazo y puedes cancelar tu suscripción cuando desees.'
      }
    ];
    
    const displayFaq = faq.length > 0 ? faq : defaultFaq;
    
    return (
      <div className={`py-6 ${className}`}>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {title || 'Preguntas Frecuentes'}
          </h2>
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className="max-w-3xl mx-auto space-y-4">
          {displayFaq.map((item, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg">
              <button
                className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {item.question}
                </span>
                <ArrowRight className={`w-4 h-4 text-gray-400 transition-transform ${
                  expandedFaq === index ? 'rotate-90' : ''
                }`} />
              </button>
              
              {expandedFaq === index && (
                <div className="px-6 pb-4 text-gray-600 dark:text-gray-400">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (variant === 'media') {
    return (
      <div className={`py-6 ${className}`}>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {title || 'Vista Previa'}
          </h2>
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        
        {media && (
          <div className="max-w-4xl mx-auto">
            {media.type === 'video' && (
              <div className="relative bg-gray-900 rounded-xl overflow-hidden">
                <div className="aspect-video flex items-center justify-center">
                  <button
                    onClick={() => handleAction('play-video', media)}
                    className="w-20 h-20 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors group"
                  >
                    <Play className="w-8 h-8 text-white ml-1 group-hover:scale-110 transition-transform" />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-white font-semibold mb-1">{media.title}</h3>
                  <p className="text-white/80 text-sm">{media.description}</p>
                </div>
              </div>
            )}
            
            {media.type === 'image' && (
              <div className="relative">
                <img
                  src={media.url}
                  alt={media.alt || media.title}
                  className="w-full rounded-xl shadow-lg"
                />
                {media.caption && (
                  <div className="mt-4 text-center text-gray-600 dark:text-gray-400 text-sm">
                    {media.caption}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  if (variant === 'testimonial') {
    return testimonial && (
      <div className={`py-6 ${className}`}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-6">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 text-yellow-400 fill-current inline-block mx-1" />
            ))}
          </div>
          
          <blockquote className="text-xl text-gray-900 dark:text-gray-100 font-medium mb-6">
            "{testimonial.quote}"
          </blockquote>
          
          <div className="flex items-center justify-center">
            {testimonial.avatar && (
              <img
                src={testimonial.avatar}
                alt={testimonial.author}
                className="w-12 h-12 rounded-full mr-4"
              />
            )}
            <div className="text-left">
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {testimonial.author}
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">
                {testimonial.role} - {testimonial.company}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // ====================================
  // RENDER POR DEFECTO
  // ====================================
  
  return (
    <div className={`py-6 ${className}`}>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Code className="w-8 h-8 text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {title}
        </h2>
        
        {subtitle && (
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
            {subtitle}
          </p>
        )}
        
        {description && (
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {description}
          </p>
        )}
      </div>
      
      {/* Contenido personalizado */}
      {children}
      
      {/* Cards */}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {cards.map((card, index) => (
            <FeatureCard key={index} {...card} />
          ))}
        </div>
      )}
      
      {/* Acciones */}
      {actions.length > 0 && (
        <div className="text-center">
          <div className="flex flex-wrap justify-center gap-3">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleAction(action.id, action)}
                className={`flex items-center px-6 py-3 font-medium rounded-lg transition-colors ${
                  action.variant === 'primary'
                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                    : action.variant === 'secondary'
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {action.icon && <action.icon className="w-4 h-4 mr-2" />}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ====================================
// PLANTILLAS PREDEFINIDAS
// ====================================

export const WelcomeContent = (props) => (
  <CustomContent variant="welcome" {...props} />
);

export const FeaturesContent = (props) => (
  <CustomContent variant="features" {...props} />
);

export const StatsContent = (props) => (
  <CustomContent variant="stats" {...props} />
);

export const PricingContent = (props) => (
  <CustomContent variant="pricing" {...props} />
);

export const FAQContent = (props) => (
  <CustomContent variant="faq" {...props} />
);

export const MediaContent = (props) => (
  <CustomContent variant="media" {...props} />
);

export const TestimonialContent = (props) => (
  <CustomContent variant="testimonial" {...props} />
);

export default CustomContent;