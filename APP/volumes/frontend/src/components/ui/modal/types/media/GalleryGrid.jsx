/**
 * types/media/GalleryGrid.jsx
 * Componente de galería con vista grid/lista
 * Selección múltiple, filtros, ordenamiento
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    Search, Grid, List, Upload, Edit, Trash2, Eye, MoreHorizontal,
    Image as ImageIcon, Video as VideoIcon, Music, FileText,
    Archive, Folder, File, Filter, SortAsc, Download
} from 'lucide-react';

// ====================================
// COMPONENTE PRINCIPAL
// ====================================

export const GalleryGrid = ({
    items = [],
    viewMode = 'grid',
    allowUpload = true,
    allowDelete = true,
    allowEdit = true,
    selectable = true,
    onItemSelect,
    onItemOpen,
    onUpload,
    onDelete,
    onEdit
}) => {
    // ====================================
    // ESTADO LOCAL
    // ====================================

    const [currentViewMode, setCurrentViewMode] = useState(viewMode);
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [filter, setFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);

    // ====================================
    // ICONOS POR TIPO
    // ====================================

    const fileTypeIcons = {
        image: ImageIcon,
        video: VideoIcon,
        audio: Music,
        document: FileText,
        archive: Archive,
        folder: Folder,
        file: File
    };

    const getFileIcon = useCallback((item) => {
        const IconComponent = fileTypeIcons[item.type] || File;
        return IconComponent;
    }, []);

    // ====================================
    // DATOS PROCESADOS
    // ====================================

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = !searchQuery || (
                item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchQuery.toLowerCase())
            );
            const matchesFilter = filter === 'all' || item.type === filter;
            return matchesSearch && matchesFilter;
        });
    }, [items, searchQuery, filter]);

    const sortedItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'name':
                    aValue = (a.name || a.title || '').toLowerCase();
                    bValue = (b.name || b.title || '').toLowerCase();
                    break;
                case 'date':
                    aValue = new Date(a.date || a.modified || 0);
                    bValue = new Date(b.date || b.modified || 0);
                    break;
                case 'size':
                    aValue = a.size || 0;
                    bValue = b.size || 0;
                    break;
                case 'type':
                    aValue = a.type || '';
                    bValue = b.type || '';
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredItems, sortBy, sortOrder]);

    const uniqueTypes = useMemo(() => {
        const types = [...new Set(items.map(item => item.type).filter(Boolean))];
        return types.sort();
    }, [items]);

    // ====================================
    // HANDLERS
    // ====================================

    const handleSelectItem = useCallback((item, isSelected) => {
        if (!selectable) return;

        const newSelection = isSelected
            ? [...selectedItems, item.id]
            : selectedItems.filter(id => id !== item.id);

        setSelectedItems(newSelection);
        onItemSelect?.(newSelection, item);
    }, [selectedItems, selectable, onItemSelect]);

    const handleSelectAll = useCallback(() => {
        if (selectedItems.length === sortedItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(sortedItems.map(item => item.id));
        }
    }, [selectedItems, sortedItems]);

    const handleSort = useCallback((field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    }, [sortBy, sortOrder]);

    const formatFileSize = useCallback((bytes) => {
        const numBytes = Number(bytes);
        if (!numBytes || isNaN(numBytes)) return '';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = numBytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }, []);


    const formatDate = useCallback((date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }, []);

    // ====================================
    // RENDER HELPERS
    // ====================================

    const renderToolbar = () => (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            {/* Búsqueda y filtros */}
            <div className="flex flex-1 items-center space-x-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar archivos..."
                        className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full"
                    />
                </div>

                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-lg border transition-colors ${showFilters
                            ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    title="Filtros"
                >
                    <Filter className="w-4 h-4" />
                </button>
            </div>

            {/* Controles de vista y acciones */}
            <div className="flex items-center space-x-2">
                <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg">
                    <button
                        onClick={() => setCurrentViewMode('grid')}
                        className={`p-2 ${currentViewMode === 'grid' ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'} transition-colors`}
                        title="Vista cuadrícula"
                    >
                        <Grid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setCurrentViewMode('list')}
                        className={`p-2 ${currentViewMode === 'list' ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'} transition-colors`}
                        title="Vista lista"
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>

                {allowUpload && (
                    <button
                        onClick={onUpload}
                        className="flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Subir
                    </button>
                )}
            </div>
        </div>
    );

    const renderFilters = () => showFilters && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tipo de archivo
                    </label>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                        <option value="all">Todos los tipos</option>
                        {uniqueTypes.map(type => (
                            <option key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}s
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Ordenar por
                    </label>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                        <option value="name">Nombre</option>
                        <option value="date">Fecha</option>
                        <option value="size">Tamaño</option>
                        <option value="type">Tipo</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Orden
                    </label>
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                        <option value="asc">Ascendente</option>
                        <option value="desc">Descendente</option>
                    </select>
                </div>
            </div>
        </div>
    );

    const renderSelectionInfo = () => selectable && selectedItems.length > 0 && (
        <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/30 rounded-lg">
            <div className="flex justify-between items-center">
                <span className="text-sm text-primary-800 dark:text-primary-200">
                    {selectedItems.length} elemento(s) seleccionado(s)
                </span>
                <div className="flex space-x-2">
                    {allowEdit && (
                        <button
                            onClick={() => onEdit?.(selectedItems)}
                            className="flex items-center px-3 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            <Edit className="w-3 h-3 mr-1" />
                            Editar
                        </button>
                    )}
                    {allowDelete && (
                        <button
                            onClick={() => onDelete?.(selectedItems)}
                            className="flex items-center px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Eliminar
                        </button>
                    )}
                    <button
                        onClick={() => setSelectedItems([])}
                        className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                        Limpiar
                    </button>
                </div>
            </div>
        </div>
    );

    const renderGridView = () => (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {sortedItems.map((item) => {
                const IconComponent = getFileIcon(item);
                const isSelected = selectedItems.includes(item.id);

                return (
                    <div
                        key={item.id}
                        className={`group relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all hover:shadow-lg ${isSelected
                                ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800 shadow-lg'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                    >
                        {/* Checkbox para selección */}
                        {selectable && (
                            <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        handleSelectItem(item, e.target.checked);
                                    }}
                                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 bg-white dark:bg-gray-700"
                                />
                            </div>
                        )}

                        {/* Thumbnail/Preview */}
                        <div
                            className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative overflow-hidden"
                            onClick={() => onItemOpen?.(item)}
                        >
                            {item.thumbnail || (item.type === 'image' && (item.url || item.src)) ? (
                                <img
                                    src={item.thumbnail || item.url || item.src}
                                    alt={item.name || item.title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <IconComponent className="w-8 h-8 text-gray-400" />
                            )}

                            {/* Overlay with actions */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="flex space-x-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onItemOpen?.(item);
                                        }}
                                        className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                                        title="Ver"
                                    >
                                        <Eye className="w-4 h-4 text-white" />
                                    </button>
                                    {allowEdit && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEdit?.([item.id]);
                                            }}
                                            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                                            title="Editar"
                                        >
                                            <Edit className="w-4 h-4 text-white" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="p-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={item.name || item.title}>
                                {item.name || item.title}
                            </div>
                            <div className="flex justify-between items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                                <span>{formatFileSize(item.size)}</span>
                                <span>{formatDate(item.date || item.modified)}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderListView = () => (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                {selectable && (
                    <div className="w-8">
                        <input
                            type="checkbox"
                            checked={selectedItems.length === sortedItems.length && sortedItems.length > 0}
                            onChange={handleSelectAll}
                            className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                        />
                    </div>
                )}
                <div className="flex-1 cursor-pointer flex items-center" onClick={() => handleSort('name')}>
                    Nombre
                    {sortBy === 'name' && (
                        <SortAsc className={`w-4 h-4 ml-1 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                    )}
                </div>
                <div className="w-24 cursor-pointer flex items-center" onClick={() => handleSort('size')}>
                    Tamaño
                    {sortBy === 'size' && (
                        <SortAsc className={`w-4 h-4 ml-1 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                    )}
                </div>
                <div className="w-32 cursor-pointer flex items-center" onClick={() => handleSort('date')}>
                    Modificado
                    {sortBy === 'date' && (
                        <SortAsc className={`w-4 h-4 ml-1 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                    )}
                </div>
                <div className="w-20">Acciones</div>
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedItems.map((item) => {
                    const IconComponent = getFileIcon(item);
                    const isSelected = selectedItems.includes(item.id);

                    return (
                        <div
                            key={item.id}
                            className={`px-4 py-3 flex items-center hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                                }`}
                            onClick={() => onItemOpen?.(item)}
                        >
                            {selectable && (
                                <div className="w-8">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            handleSelectItem(item, e.target.checked);
                                        }}
                                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                    />
                                </div>
                            )}

                            <div className="flex-1 flex items-center min-w-0">
                                <IconComponent className="w-8 h-8 text-gray-400 mr-3 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {item.name || item.title}
                                    </div>
                                    {item.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="w-24 text-sm text-gray-500 dark:text-gray-400">
                                {formatFileSize(item.size)}
                            </div>

                            <div className="w-32 text-sm text-gray-500 dark:text-gray-400">
                                {formatDate(item.date || item.modified)}
                            </div>

                            <div className="w-20 flex items-center space-x-1">
                                {allowEdit && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit?.([item.id]);
                                        }}
                                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                        title="Editar"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                )}
                                {allowDelete && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete?.([item.id]);
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No hay elementos</p>
            <p className="text-sm text-center">
                {searchQuery ? 'No se encontraron elementos que coincidan con tu búsqueda' : 'La galería está vacía'}
            </p>
            {allowUpload && !searchQuery && (
                <button
                    onClick={onUpload}
                    className="flex items-center px-4 py-2 mt-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Subir archivos
                </button>
            )}
        </div>
    );

    // ====================================
    // RENDER PRINCIPAL
    // ====================================

    return (
        <div className="space-y-4">
            {renderToolbar()}
            {renderFilters()}
            {renderSelectionInfo()}

            <div className="min-h-[300px]">
                {sortedItems.length > 0 ? (
                    currentViewMode === 'grid' ? renderGridView() : renderListView()
                ) : (
                    renderEmptyState()
                )}
            </div>
        </div>
    );
};

export default GalleryGrid;