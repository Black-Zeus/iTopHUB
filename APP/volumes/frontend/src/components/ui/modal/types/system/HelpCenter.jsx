/**
 * types/system/HelpCenter.jsx
 * Centro de ayuda interactivo con búsqueda
 * Categorías, artículos populares, FAQ, contacto
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    Search, Book, MessageCircle, Phone, Mail, ExternalLink,
    ChevronRight, Star, Clock, User, Tag, Bookmark,
    ThumbsUp, ThumbsDown, Copy, Share, Download
} from 'lucide-react';


import logger from '@/utils/logger';
const modalLog = logger.scope("modal");

// ====================================
// ICONOS POR CATEGORÍA
// ====================================

const CategoryIcons = {
    'getting-started': '🚀',
    'tutorials': '📚',
    'faq': '❓',
    'api': '⚙️',
    'billing': '💳',
    'account': '👤',
    'security': '🔒',
    'mobile': '📱',
    'integrations': '🔗',
    'troubleshooting': '🔧'
};

// ====================================
// COMPONENTE PRINCIPAL
// ====================================

export const HelpCenter = ({
    categories = [],
    popularArticles = [],
    searchQuery = '',
    searchResults = [],
    recentArticles = [],
    featuredArticle = null,
    contactOptions = [],
    onSearch,
    onCategorySelect,
    onArticleSelect,
    onContactSelect,
    onFeedback,
    showSearch = true,
    showPopular = true,
    showRecent = true,
    showContact = true
}) => {
    // ====================================
    // ESTADO LOCAL
    // ====================================

    const [currentQuery, setCurrentQuery] = useState(searchQuery);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [bookmarkedArticles, setBookmarkedArticles] = useState([]);
    const [articleRatings, setArticleRatings] = useState({});

    // ====================================
    // DATOS POR DEFECTO
    // ====================================

    const defaultCategories = [
        {
            id: 'getting-started',
            name: 'Primeros Pasos',
            description: 'Todo lo que necesitas para comenzar',
            icon: '🚀',
            articleCount: 12,
            color: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800/30 dark:text-blue-300'
        },
        {
            id: 'tutorials',
            name: 'Tutoriales',
            description: 'Guías paso a paso detalladas',
            icon: '📚',
            articleCount: 24,
            color: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800/30 dark:text-green-300'
        },
        {
            id: 'faq',
            name: 'Preguntas Frecuentes',
            description: 'Respuestas a las dudas más comunes',
            icon: '❓',
            articleCount: 18,
            color: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800/30 dark:text-purple-300'
        },
        {
            id: 'troubleshooting',
            name: 'Solución de Problemas',
            description: 'Resuelve problemas técnicos',
            icon: '🔧',
            articleCount: 15,
            color: 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800/30 dark:text-orange-300'
        }
    ];

    const defaultPopularArticles = [
        {
            id: 1,
            title: 'Cómo crear tu primer proyecto',
            description: 'Guía completa para comenzar con la plataforma',
            category: 'getting-started',
            readTime: 5,
            rating: 4.8,
            views: 1250
        },
        {
            id: 2,
            title: 'Configuración de notificaciones',
            description: 'Personaliza las alertas según tus preferencias',
            category: 'tutorials',
            readTime: 3,
            rating: 4.6,
            views: 980
        },
        {
            id: 3,
            title: 'Gestión de usuarios y permisos',
            description: 'Controla el acceso y los roles de tu equipo',
            category: 'tutorials',
            readTime: 8,
            rating: 4.9,
            views: 856
        }
    ];

    const defaultContactOptions = [
        {
            id: 'chat',
            name: 'Chat en vivo',
            description: 'Respuesta inmediata de 9:00 a 18:00',
            icon: MessageCircle,
            available: true,
            eta: 'Inmediato'
        },
        {
            id: 'email',
            name: 'Correo electrónico',
            description: 'Envíanos un mensaje detallado',
            icon: Mail,
            available: true,
            eta: '24 horas'
        },
        {
            id: 'phone',
            name: 'Teléfono',
            description: 'Llámanos directamente',
            icon: Phone,
            available: false,
            eta: 'No disponible'
        }
    ];

    const finalCategories = categories.length > 0 ? categories : defaultCategories;
    const finalPopularArticles = popularArticles.length > 0 ? popularArticles : defaultPopularArticles;
    const finalContactOptions = contactOptions.length > 0 ? contactOptions : defaultContactOptions;

    // ====================================
    // HANDLERS
    // ====================================

    const handleSearch = useCallback(async (query) => {
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            await onSearch?.(query);
        } catch (error) {
            modalLog.error('Error searching:', error);
        } finally {
            setIsSearching(false);
        }
    }, [onSearch]);

    const handleCategoryClick = useCallback((category) => {
        setSelectedCategory(category);
        onCategorySelect?.(category);
    }, [onCategorySelect]);

    const handleArticleClick = useCallback((article) => {
        onArticleSelect?.(article);
    }, [onArticleSelect]);

    const toggleBookmark = useCallback((articleId) => {
        setBookmarkedArticles(prev =>
            prev.includes(articleId)
                ? prev.filter(id => id !== articleId)
                : [...prev, articleId]
        );
    }, []);

    const handleRating = useCallback((articleId, rating) => {
        setArticleRatings(prev => ({ ...prev, [articleId]: rating }));
        onFeedback?.(articleId, rating);
    }, [onFeedback]);

    // ====================================
    // RENDER HELPERS
    // ====================================

    const renderSearchBar = () => showSearch && (
        <div className="mb-8">
            <div className="relative max-w-2xl mx-auto">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    value={currentQuery}
                    onChange={(e) => setCurrentQuery(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            handleSearch(currentQuery);
                        }
                    }}
                    placeholder="¿En qué podemos ayudarte?"
                    className="block w-full pl-12 pr-4 py-4 text-lg border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <button
                        onClick={() => handleSearch(currentQuery)}
                        disabled={isSearching || !currentQuery.trim()}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        {isSearching ? 'Buscando...' : 'Buscar'}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderFeaturedArticle = () => featuredArticle && (
        <div className="mb-8 p-6 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center mb-2">
                        <Star className="w-5 h-5 mr-2" />
                        <span className="text-sm font-medium opacity-90">Artículo destacado</span>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{featuredArticle.title}</h3>
                    <p className="text-primary-100 mb-4">{featuredArticle.description}</p>
                    <button
                        onClick={() => handleArticleClick(featuredArticle)}
                        className="inline-flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-colors"
                    >
                        Leer artículo
                        <ChevronRight className="w-4 h-4 ml-2" />
                    </button>
                </div>
                <div className="ml-6">
                    <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center text-2xl">
                        {featuredArticle.icon || '📖'}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderCategories = () => (
        <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Explorar por categoría
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {finalCategories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => handleCategoryClick(category)}
                        className={`p-4 rounded-lg border-2 border-dashed transition-all hover:border-solid hover:shadow-md text-left ${category.color}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">{category.icon}</span>
                            <span className="text-xs font-medium opacity-75">
                                {category.articleCount} artículos
                            </span>
                        </div>
                        <h3 className="font-semibold mb-1">{category.name}</h3>
                        <p className="text-sm opacity-80">{category.description}</p>
                    </button>
                ))}
            </div>
        </div>
    );

    // 🔴 AQUÍ: key SE ELIMINA del div INTERNO, EL key VA EN EL map EXTERNO
    const renderArticleCard = useCallback((article, showCategory = true) => {
        const isBookmarked = bookmarkedArticles.includes(article.id);
        const userRating = articleRatings[article.id];

        return (
            <div
                className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleArticleClick(article)}
            >
                <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                            {article.title}
                        </h3>
                        {article.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                {article.description}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(article.id);
                        }}
                        className={`ml-2 p-1 rounded transition-colors ${isBookmarked
                                ? 'text-yellow-500 hover:text-yellow-600'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                    </button>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-3">
                        {showCategory && article.category && (
                            <span className="flex items-center">
                                <Tag className="w-3 h-3 mr-1" />
                                {finalCategories.find(cat => cat.id === article.category)?.name || article.category}
                            </span>
                        )}
                        {article.readTime && (
                            <span className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {article.readTime} min
                            </span>
                        )}
                        {article.views && (
                            <span className="flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                {article.views.toLocaleString()} vistas
                            </span>
                        )}
                    </div>

                    {article.rating && (
                        <div className="flex items-center">
                            <Star className="w-3 h-3 text-yellow-400 fill-current mr-1" />
                            <span>{article.rating}</span>
                        </div>
                    )}
                </div>

                {userRating && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <span className="mr-2">Tu valoración:</span>
                            <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                        key={star}
                                        className={`w-3 h-3 ${star <= userRating
                                                ? 'text-yellow-400 fill-current'
                                                : 'text-gray-300 dark:text-gray-600'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }, [bookmarkedArticles, articleRatings, handleArticleClick, toggleBookmark, finalCategories]);

    const renderPopularArticles = () => showPopular && finalPopularArticles.length > 0 && (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Artículos populares
                </h2>
                <button className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium">
                    Ver todos
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {finalPopularArticles.map((article, idx) => (
                    <div key={article.id ?? `article-${idx}`}>
                        {renderArticleCard(article)}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderSearchResults = () => searchResults.length > 0 && (
        <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Resultados de búsqueda ({searchResults.length})
            </h2>
            <div className="space-y-4">
                {searchResults.map(article => (
                    <div key={article.id}>
                        {renderArticleCard(article)}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderRecentArticles = () => showRecent && recentArticles.length > 0 && (
        <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Artículos recientes
            </h2>
            <div className="space-y-3">
                {recentArticles.slice(0, 5).map((article) => (
                    <div
                        key={article.id}
                        className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => handleArticleClick(article)}
                    >
                        <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg flex items-center justify-center mr-3 text-sm">
                            {CategoryIcons[article.category] || '📄'}
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {article.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {article.date && new Date(article.date).toLocaleDateString()}
                            </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                ))}
            </div>
        </div>
    );

    const renderContactOptions = () => showContact && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                ¿Necesitas más ayuda?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Nuestro equipo de soporte está aquí para ayudarte
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {finalContactOptions.map((option) => {
                    const IconComponent = option.icon;

                    return (
                        <button
                            key={option.id}
                            onClick={() => onContactSelect?.(option)}
                            disabled={!option.available}
                            className={`p-4 text-left rounded-lg border-2 transition-all ${option.available
                                    ? 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm'
                                    : 'border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed'
                                } bg-white dark:bg-gray-900`}
                        >
                            <div className="flex items-center mb-2">
                                <IconComponent className={`w-5 h-5 mr-2 ${option.available ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
                                    }`} />
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {option.name}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {option.description}
                            </p>
                            <span className={`text-xs px-2 py-1 rounded-full ${option.available
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                }`}>
                                {option.eta}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    // ====================================
    // RENDER PRINCIPAL
    // ====================================

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Centro de Ayuda
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                    Encuentra respuestas rápidas a tus preguntas
                </p>
            </div>

            {/* Búsqueda */}
            {renderSearchBar()}

            {/* Artículo destacado */}
            {renderFeaturedArticle()}

            {/* Resultados de búsqueda */}
            {renderSearchResults()}

            {/* Categorías */}
            {!searchResults.length && renderCategories()}

            {/* Artículos populares */}
            {!searchResults.length && renderPopularArticles()}

            {/* Artículos recientes */}
            {!searchResults.length && renderRecentArticles()}

            {/* Opciones de contacto */}
            {renderContactOptions()}
        </div>
    );
};

export default HelpCenter;
