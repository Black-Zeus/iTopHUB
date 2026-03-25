/**
 * types/media/FileManager.jsx
 * Gestor de archivos completo con navegación, breadcrumbs
 * Vista grid/lista, operaciones de archivos, búsqueda
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    Folder, File, Image as ImageIcon, Video as VideoIcon, Music, FileText,
    Archive, Upload, Search, Grid, List, SortAsc, Eye, Edit, Trash2, Copy,
    Move, MoreHorizontal, ChevronRight, Home, ArrowLeft, Plus, Download
} from 'lucide-react';

// ====================================
// COMPONENTE PRINCIPAL
// ====================================

export const FileManager = ({
    currentPath = '/',
    files = [],
    allowUpload = true,
    allowCreateFolder = true,
    allowDelete = true,
    allowRename = true,
    allowMove = true,
    allowCopy = true,
    onNavigate,
    onFileSelect,
    onUpload,
    onCreateFolder,
    onDelete,
    onRename,
    onMove,
    onCopy,
    onDownload
}) => {
    // ====================================
    // ESTADO LOCAL
    // ====================================

    const [selectedFiles, setSelectedFiles] = useState([]);
    const [viewMode, setViewMode] = useState('list');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showHidden, setShowHidden] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [contextMenu, setContextMenu] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    // ====================================
    // ICONOS POR TIPO
    // ====================================

    const fileTypeIcons = {
        folder: Folder,
        image: ImageIcon,
        video: VideoIcon,
        audio: Music,
        document: FileText,
        text: FileText,
        archive: Archive,
        unknown: File
    };

    const getFileIcon = useCallback((file) => {
        if (file.type === 'folder') return Folder;

        const extension = file.name?.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) return ImageIcon;
        if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm'].includes(extension)) return VideoIcon;
        if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension)) return Music;
        if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'md'].includes(extension)) return FileText;
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return Archive;

        return File;
    }, []);

    // ====================================
    // DATOS PROCESADOS
    // ====================================

    const filteredFiles = useMemo(() => {
        return files.filter(file => {
            if (!showHidden && file.name?.startsWith('.')) return false;
            if (searchQuery && !file.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [files, showHidden, searchQuery]);

    const sortedFiles = useMemo(() => {
        return [...filteredFiles].sort((a, b) => {
            // Carpetas siempre primero
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;

            let aValue, bValue;
            switch (sortBy) {
                case 'name':
                    aValue = a.name?.toLowerCase() || '';
                    bValue = b.name?.toLowerCase() || '';
                    break;
                case 'size':
                    aValue = a.size || 0;
                    bValue = b.size || 0;
                    break;
                case 'date':
                    aValue = new Date(a.modified || 0);
                    bValue = new Date(b.modified || 0);
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
    }, [filteredFiles, sortBy, sortOrder]);

    const pathParts = useMemo(() => {
        return currentPath.split('/').filter(Boolean);
    }, [currentPath]);

    // ====================================
    // HANDLERS
    // ====================================

    const handleFileSelect = useCallback((file, isSelected) => {
        const newSelection = isSelected
            ? [...selectedFiles, file.id]
            : selectedFiles.filter(id => id !== file.id);

        setSelectedFiles(newSelection);
    }, [selectedFiles]);

    const handleSelectAll = useCallback(() => {
        if (selectedFiles.length === sortedFiles.length) {
            setSelectedFiles([]);
        } else {
            setSelectedFiles(sortedFiles.map(file => file.id));
        }
    }, [selectedFiles, sortedFiles]);

    const handleSort = useCallback((field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    }, [sortBy, sortOrder]);

    const handleDoubleClick = useCallback((file) => {
        if (file.type === 'folder') {
            const newPath = currentPath.endsWith('/') ? currentPath + file.name : currentPath + '/' + file.name;
            onNavigate?.(newPath);
        } else {
            onFileSelect?.(file);
        }
    }, [currentPath, onNavigate, onFileSelect]);

    const handleContextMenu = useCallback((e, file) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            file
        });
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            onUpload?.(files);
        }
    }, [onUpload]);

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
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }, []);

    // ====================================
    // RENDER HELPERS
    // ====================================

    const renderBreadcrumb = () => (
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 text-sm overflow-x-auto">
                <button
                    onClick={() => onNavigate?.('/')}
                    className="flex items-center text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors"
                    title="Inicio"
                >
                    <Home className="w-4 h-4" />
                </button>

                {pathParts.map((part, index) => (
                    <React.Fragment key={index}>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <button
                            onClick={() => onNavigate?.('/' + pathParts.slice(0, index + 1).join('/'))}
                            className="text-primary-600 hover:text-primary-500 dark:text-primary-400 hover:underline transition-colors"
                        >
                            {part}
                        </button>
                    </React.Fragment>
                ))}
            </div>

            <div className="flex items-center space-x-2">
                {pathParts.length > 0 && (
                    <button
                        onClick={() => {
                            const parentPath = '/' + pathParts.slice(0, -1).join('/');
                            onNavigate?.(parentPath === '/' ? '/' : parentPath);
                        }}
                        className="flex items-center px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Atrás
                    </button>
                )}

                {allowCreateFolder && (
                    <button
                        onClick={onCreateFolder}
                        className="flex items-center px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Carpeta
                    </button>
                )}

                {allowUpload && (
                    <button
                        onClick={() => document.getElementById('file-upload')?.click()}
                        className="flex items-center px-3 py-1 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
                    >
                        <Upload className="w-4 h-4 mr-1" />
                        Subir
                    </button>
                )}
            </div>
        </div>
    );

    const renderToolbar = () => (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center space-x-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar archivos..."
                        className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-64"
                    />
                </div>

                <label className="flex items-center text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showHidden}
                        onChange={(e) => setShowHidden(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 mr-2"
                    />
                    Mostrar ocultos
                </label>
            </div>

            <div className="flex items-center space-x-2">
                <div className="flex border border-gray-300 dark:border-gray-600 rounded">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 ${viewMode === 'grid' ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'} transition-colors`}
                    >
                        <Grid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 ${viewMode === 'list' ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'} transition-colors`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderSelectionInfo = () => selectedFiles.length > 0 && (
        <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/30 rounded-lg">
            <div className="flex justify-between items-center">
                <span className="text-sm text-primary-800 dark:text-primary-200">
                    {selectedFiles.length} archivo(s) seleccionado(s)
                </span>
                <div className="flex space-x-2">
                    {allowCopy && (
                        <button
                            onClick={() => onCopy?.(selectedFiles)}
                            className="flex items-center px-3 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            <Copy className="w-3 h-3 mr-1" />
                            Copiar
                        </button>
                    )}
                    {allowMove && (
                        <button
                            onClick={() => onMove?.(selectedFiles)}
                            className="flex items-center px-3 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            <Move className="w-3 h-3 mr-1" />
                            Mover
                        </button>
                    )}
                    {allowRename && selectedFiles.length === 1 && (
                        <button
                            onClick={() => onRename?.(selectedFiles[0])}
                            className="flex items-center px-3 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            <Edit className="w-3 h-3 mr-1" />
                            Renombrar
                        </button>
                    )}
                    {allowDelete && (
                        <button
                            onClick={() => onDelete?.(selectedFiles)}
                            className="flex items-center px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Eliminar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    const renderListView = () => (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                <div className="w-8">
                    <input
                        type="checkbox"
                        checked={selectedFiles.length === sortedFiles.length && sortedFiles.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                </div>
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
                <div className="w-40 cursor-pointer flex items-center" onClick={() => handleSort('date')}>
                    Modificado
                    {sortBy === 'date' && (
                        <SortAsc className={`w-4 h-4 ml-1 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                    )}
                </div>
                <div className="w-20">Acciones</div>
            </div>

            {/* Files */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedFiles.map((file) => {
                    const IconComponent = getFileIcon(file);
                    const isSelected = selectedFiles.includes(file.id);

                    return (
                        <div
                            key={file.id}
                            className={`px-4 py-3 flex items-center hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                                }`}
                            onDoubleClick={() => handleDoubleClick(file)}
                            onContextMenu={(e) => handleContextMenu(e, file)}
                        >
                            <div className="w-8">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        handleFileSelect(file, e.target.checked);
                                    }}
                                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                />
                            </div>

                            <div className="flex-1 flex items-center min-w-0">
                                <IconComponent className={`w-5 h-5 mr-3 flex-shrink-0 ${file.type === 'folder' ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-400'
                                    }`} />
                                <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                    {file.name}
                                </span>
                            </div>

                            <div className="w-24 text-sm text-gray-500 dark:text-gray-400">
                                {file.type !== 'folder' ? formatFileSize(file.size) : '—'}
                            </div>

                            <div className="w-40 text-sm text-gray-500 dark:text-gray-400">
                                {formatDate(file.modified)}
                            </div>

                            <div className="w-20 flex items-center space-x-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onFileSelect?.(file);
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                    title="Ver"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                                {allowRename && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRename?.(file.id);
                                        }}
                                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                        title="Renombrar"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                )}
                                {allowDelete && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete?.([file.id]);
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderGridView = () => (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {sortedFiles.map((file) => {
                const IconComponent = getFileIcon(file);
                const isSelected = selectedFiles.includes(file.id);

                return (
                    <div
                        key={file.id}
                        className={`group relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all hover:shadow-lg ${isSelected
                                ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                        onDoubleClick={() => handleDoubleClick(file)}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                    >
                        <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    handleFileSelect(file, e.target.checked);
                                }}
                                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 bg-white dark:bg-gray-700"
                            />
                        </div>

                        <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <IconComponent className={`w-8 h-8 ${file.type === 'folder' ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-400'
                                }`} />
                        </div>

                        <div className="p-2">
                            <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate" title={file.name}>
                                {file.name}
                            </div>
                            {file.type !== 'folder' && file.size && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatFileSize(file.size)}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Folder className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Carpeta vacía</p>
            <p className="text-sm text-center">
                {searchQuery ? 'No se encontraron archivos que coincidan con tu búsqueda' : 'Esta carpeta no contiene archivos'}
            </p>
        </div>
    );

    const renderContextMenu = () => contextMenu && (
        <div
            className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseLeave={() => setContextMenu(null)}
        >
            <button
                onClick={() => {
                    onFileSelect?.(contextMenu.file);
                    setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
            >
                <Eye className="w-4 h-4 mr-2" />
                Abrir
            </button>
            {allowRename && (
                <button
                    onClick={() => {
                        onRename?.(contextMenu.file.id);
                        setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                >
                    <Edit className="w-4 h-4 mr-2" />
                    Renombrar
                </button>
            )}
            {onDownload && contextMenu.file.type !== 'folder' && (
                <button
                    onClick={() => {
                        onDownload?.(contextMenu.file);
                        setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar
                </button>
            )}
            {allowDelete && (
                <button
                    onClick={() => {
                        onDelete?.([contextMenu.file.id]);
                        setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 flex items-center"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                </button>
            )}
        </div>
    );

    // ====================================
    // RENDER PRINCIPAL
    // ====================================

    return (
        <div
            className={`space-y-4 ${dragOver ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-lg' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => setContextMenu(null)}
        >
            {/* Hidden file input */}
            <input
                id="file-upload"
                type="file"
                multiple
                onChange={(e) => onUpload?.(Array.from(e.target.files))}
                className="hidden"
            />

            {renderBreadcrumb()}
            {renderToolbar()}
            {renderSelectionInfo()}

            <div className="min-h-[300px] relative">
                {dragOver && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary-50/90 dark:bg-primary-900/20 rounded-lg z-10">
                        <div className="text-center">
                            <Upload className="w-12 h-12 text-primary-500 mx-auto mb-2" />
                            <p className="text-lg font-medium text-primary-700 dark:text-primary-300">
                                Suelta los archivos aquí
                            </p>
                        </div>
                    </div>
                )}

                {sortedFiles.length > 0 ? (
                    viewMode === 'list' ? renderListView() : renderGridView()
                ) : (
                    renderEmptyState()
                )}
            </div>

            {renderContextMenu()}
        </div>
    );
};

export default FileManager;