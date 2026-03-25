/**
 * types/DataModals.jsx
 * Modales de datos: search, datatable, calendar
 * Modales para gestión y visualización de información
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Filter, Download, Upload, Plus, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import {
    MODAL_CLASSES,
    getModalConfig
} from '../modalTypes.js';


import logger from '@/utils/logger';
const modalLog = logger.scope("modal");

// ====================================
// COMPONENTE DE BÚSQUEDA AVANZADA
// ====================================

const SearchModalContent = ({
    type = 'search',
    title,
    placeholder = 'Ingrese términos de búsqueda...',
    filters = [],
    recentSearches = [],
    results = [],
    categories = ['Todas las categorías', 'Documentos', 'Imágenes', 'Videos', 'Usuarios'],
    dateRanges = ['Cualquier fecha', 'Última semana', 'Último mes', 'Último año'],
    onClose,
    onSearch,
    onFilterChange,
    onResultSelect
}) => {
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories[0]);
    const [selectedDateRange, setSelectedDateRange] = useState(dateRanges[0]);
    const [activeFilters, setActiveFilters] = useState({});
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = useCallback(async () => {
        if (!query.trim() && Object.keys(activeFilters).length === 0) return;

        setIsSearching(true);
        try {
            await onSearch?.({
                query: query.trim(),
                category: selectedCategory,
                dateRange: selectedDateRange,
                filters: activeFilters
            });
        } catch (error) {
            modalLog.error('Error searching:', error);
        } finally {
            setIsSearching(false);
        }
    }, [query, selectedCategory, selectedDateRange, activeFilters, onSearch]);

    const handleFilterChange = useCallback((filterName, value) => {
        const newFilters = { ...activeFilters, [filterName]: value };
        setActiveFilters(newFilters);
        onFilterChange?.(newFilters);
    }, [activeFilters, onFilterChange]);

    const handleKeyPress = useCallback((e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    }, [handleSearch]);

    return (
        <>
            {/* Body */}
            <div className={MODAL_CLASSES.bodyContent}>
                {/* Campo de búsqueda principal */}
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={placeholder}
                            className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg"
                        />
                    </div>

                    {/* Filtros básicos */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Categoría
                            </label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className={MODAL_CLASSES.form.input}
                            >
                                {categories.map((category, index) => (
                                    <option key={index} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Fecha
                            </label>
                            <select
                                value={selectedDateRange}
                                onChange={(e) => setSelectedDateRange(e.target.value)}
                                className={MODAL_CLASSES.form.input}
                            >
                                {dateRanges.map((range, index) => (
                                    <option key={index} value={range}>{range}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Filtros avanzados */}
                    {filters.length > 0 && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div className="flex items-center mb-3">
                                <Filter className="w-4 h-4 mr-2 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros avanzados</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {filters.map((filter, index) => (
                                    <div key={index}>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            {filter.label}
                                        </label>
                                        {filter.type === 'select' ? (
                                            <select
                                                value={activeFilters[filter.name] || ''}
                                                onChange={(e) => handleFilterChange(filter.name, e.target.value)}
                                                className={MODAL_CLASSES.form.input}
                                            >
                                                <option value="">Cualquiera</option>
                                                {filter.options?.map((option, idx) => (
                                                    <option key={idx} value={option.value || option}>
                                                        {option.label || option}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type={filter.type || 'text'}
                                                value={activeFilters[filter.name] || ''}
                                                onChange={(e) => handleFilterChange(filter.name, e.target.value)}
                                                placeholder={filter.placeholder}
                                                className={MODAL_CLASSES.form.input}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resultados */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 min-h-[200px]">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                            {results.length > 0 ? `Resultados (${results.length})` : 'Resultados de búsqueda'}
                        </h4>

                        {results.length > 0 ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {results.map((result, index) => (
                                    <div
                                        key={index}
                                        onClick={() => onResultSelect?.(result)}
                                        className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer transition-colors flex items-center"
                                    >
                                        <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-600 flex items-center justify-center mr-3">
                                            <span className="text-lg">{result.icon || '📄'}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {result.title || result.name}
                                            </div>
                                            {result.description && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {result.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : recentSearches.length > 0 ? (
                            <div className="space-y-2">
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Búsquedas recientes:</div>
                                {recentSearches.slice(0, 5).map((search, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setQuery(search)}
                                        className="block w-full text-left p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                    >
                                        {search}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                                <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Ingrese términos de búsqueda para ver resultados</p>
                            </div>
                        )}
                    </div>
                </div>
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
                        onClick={handleSearch}
                        disabled={isSearching || (!query.trim() && Object.keys(activeFilters).length === 0)}
                        className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
                    >
                        {isSearching ? (
                            <>
                                <Search className="w-4 h-4 mr-2 animate-pulse" />
                                Buscando...
                            </>
                        ) : (
                            <>
                                <Search className="w-4 h-4 mr-2" />
                                Buscar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
};

// ====================================
// COMPONENTE DE TABLA DE DATOS
// ====================================

const DataTableModalContent = ({
    type = 'datatable',
    title,
    data = [],
    columns = [],
    actions = [],
    pagination = true,
    filtering = true,
    sorting = true,
    selection = false,
    pageSize = 10,
    onClose,
    onRowAction,
    onSelectionChange,
    onExport,
    onAdd
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [filterQuery, setFilterQuery] = useState('');
    const [sortColumn, setSortColumn] = useState('');
    const [sortDirection, setSortDirection] = useState('asc');
    const [selectedRows, setSelectedRows] = useState([]);

    // Datos filtrados y ordenados
    const filteredData = useMemo(() => {
        if (!filterQuery) return data;

        return data.filter(row =>
            Object.values(row).some(value =>
                value?.toString().toLowerCase().includes(filterQuery.toLowerCase())
            )
        );
    }, [data, filterQuery]);

    const sortedData = useMemo(() => {
        if (!sortColumn) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortColumn, sortDirection]);

    // Paginación
    const totalPages = Math.ceil(sortedData.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

    const handleSort = useCallback((column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    }, [sortColumn, sortDirection]);

    const handleSelectRow = useCallback((rowId, checked) => {
        const newSelection = checked
            ? [...selectedRows, rowId]
            : selectedRows.filter(id => id !== rowId);

        setSelectedRows(newSelection);
        onSelectionChange?.(newSelection);
    }, [selectedRows, onSelectionChange]);

    const handleSelectAll = useCallback((checked) => {
        const newSelection = checked
            ? paginatedData.map(row => row.id)
            : [];

        setSelectedRows(newSelection);
        onSelectionChange?.(newSelection);
    }, [paginatedData, onSelectionChange]);

    // Columnas por defecto si no se proporcionan
    const defaultColumns = data.length > 0 ? Object.keys(data[0]).map(key => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        sortable: true
    })) : [];

    const tableColumns = columns.length > 0 ? columns : defaultColumns;

    return (
        <>
            {/* Body */}
            <div className={MODAL_CLASSES.bodyContent}>
                {/* Header con filtro y acciones */}
                <div className="flex justify-between items-center mb-4">
                    {filtering && (
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                placeholder="Filtrar datos..."
                                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                        </div>
                    )}

                    <div className="flex items-center space-x-2 ml-4">
                        {onAdd && (
                            <button
                                onClick={onAdd}
                                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Agregar
                            </button>
                        )}
                        {onExport && (
                            <button
                                onClick={() => onExport(selectedRows.length > 0 ? selectedRows : sortedData)}
                                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary} flex items-center`}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Exportar
                            </button>
                        )}
                    </div>
                </div>

                {/* Información de selección */}
                {selection && selectedRows.length > 0 && (
                    <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/30 rounded-lg">
                        <p className="text-sm text-primary-800 dark:text-primary-200">
                            {selectedRows.length} elemento(s) seleccionado(s)
                        </p>
                    </div>
                )}

                {/* Tabla */}
                <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    {selection && (
                                        <th className="px-4 py-3 text-left">
                                            <input
                                                type="checkbox"
                                                checked={paginatedData.length > 0 && paginatedData.every(row => selectedRows.includes(row.id))}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                            />
                                        </th>
                                    )}
                                    {tableColumns.map((column) => (
                                        <th
                                            key={column.key}
                                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${column.sortable && sorting ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''
                                                }`}
                                            onClick={() => column.sortable && sorting && handleSort(column.key)}
                                        >
                                            <div className="flex items-center">
                                                {column.label}
                                                {column.sortable && sorting && sortColumn === column.key && (
                                                    <span className="ml-1">
                                                        {sortDirection === 'asc' ? '↑' : '↓'}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    {actions.length > 0 && (
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Acciones
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {paginatedData.map((row, index) => (
                                    <tr key={row.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                        {selection && (
                                            <td className="px-4 py-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRows.includes(row.id)}
                                                    onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                                                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                                />
                                            </td>
                                        )}
                                        {tableColumns.map((column) => (
                                            <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                                {column.render ? column.render(row[column.key], row) : row[column.key]}
                                            </td>
                                        ))}
                                        {actions.length > 0 && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                                {actions.map((action, actionIndex) => (
                                                    <button
                                                        key={actionIndex}
                                                        onClick={() => onRowAction?.(action.name, row)}
                                                        className={`text-${action.color || 'primary'}-600 hover:text-${action.color || 'primary'}-900 dark:hover:text-${action.color || 'primary'}-400`}
                                                        title={action.label}
                                                    >
                                                        {action.icon === 'edit' && <Edit className="w-4 h-4" />}
                                                        {action.icon === 'delete' && <Trash2 className="w-4 h-4" />}
                                                        {action.icon === 'more' && <MoreHorizontal className="w-4 h-4" />}
                                                        {!action.icon && action.label}
                                                    </button>
                                                ))}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Paginación */}
                {pagination && totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                            Mostrando {startIndex + 1} - {Math.min(startIndex + pageSize, sortedData.length)} de {sortedData.length} resultados
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary} p-2 disabled:opacity-50`}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Página {currentPage} de {totalPages}
                            </span>

                            <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary} p-2 disabled:opacity-50`}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
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
                </div>
            </div>
        </>
    );
};

// ====================================
// COMPONENTE DE CALENDARIO
// ====================================

const CalendarModalContent = ({
    type = 'calendar',
    title,
    events = [],
    selectedDate = new Date(),
    selectedStartDate = null,
    selectedEndDate = null,
    rangeSelection = false, // Habilita selección de rango
    onClose,
    onDateSelect,
    onRangeSelect,
    onEventSelect,
    onEventCreate,
    showFooter = false   // <<--- por defecto oculto
}) => {
    const [currentDate, setCurrentDate] = useState(new Date(selectedDate));
    const [startDate, setStartDate] = useState(selectedStartDate);
    const [endDate, setEndDate] = useState(selectedEndDate);

    // Genera días del mes (42 días, vista tipo calendario tradicional)
    const generateCalendarDays = useCallback(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const days = [];
        const current = new Date(startDate);

        for (let i = 0; i < 42; i++) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return days;
    }, [currentDate]);

    const calendarDays = generateCalendarDays();
    const today = new Date();
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const navigateMonth = useCallback((direction) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + direction);
        setCurrentDate(newDate);
    }, [currentDate]);

    const isToday = (date) => date.toDateString() === today.toDateString();
    const isCurrentMonth = (date) => date.getMonth() === currentDate.getMonth();

    // Verifica si una fecha está dentro del rango seleccionado
    const isInRange = (date) => {
        if (!startDate || !endDate) return false;
        return date >= startDate && date <= endDate;
    };

    // Verifica si una fecha es inicio o fin del rango
    const isRangeEdge = (date) => {
        if (!startDate || !endDate) return false;
        return date.getTime() === startDate.getTime() || date.getTime() === endDate.getTime();
    };

    // Selección de fecha(s)
    const handleDateClick = (date) => {
        if (rangeSelection) {
            if (!startDate || (startDate && endDate)) {
                setStartDate(date);
                setEndDate(null);
                onRangeSelect?.(date, null);
            } else if (date < startDate) {
                setEndDate(startDate);
                setStartDate(date);
                onRangeSelect?.(date, startDate);
            } else if (date > startDate) {
                setEndDate(date);
                onRangeSelect?.(startDate, date);
            } else {
                // Click mismo día: reset
                setStartDate(date);
                setEndDate(null);
                onRangeSelect?.(date, null);
            }
        } else {
            setStartDate(date);
            setEndDate(null);
            onDateSelect?.(date);
        }
    };

    // Eventos de cada día
    const getEventsForDate = (date) =>
        events.filter(event => new Date(event.date).toDateString() === date.toDateString());

    const handleEventClick = (event, e) => {
        e.stopPropagation();
        onEventSelect?.(event);
    };

    // Estilo base para día
    const baseDayClass =
        "min-h-[56px] sm:min-h-[44px] max-h-[80px] p-1 sm:p-2 border border-gray-200 dark:border-gray-700 cursor-pointer text-xs sm:text-sm transition-colors relative overflow-hidden rounded-lg";

    return (
        <>
            <div className={MODAL_CLASSES.bodyContent}>
                {/* Header calendario */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h3>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => navigateMonth(-1)} className="p-2">{/* Icono */}‹</button>
                        <button onClick={() => setCurrentDate(new Date())} className="px-2 py-1 text-xs sm:text-sm">Hoy</button>
                        <button onClick={() => navigateMonth(1)} className="p-2">{/* Icono */}›</button>
                        {onEventCreate && (
                            <button onClick={() => onEventCreate(currentDate)} className="ml-2 px-2 py-1 text-xs sm:text-sm">+ Evento</button>
                        )}
                    </div>
                </div>

                {/* Días de la semana */}
                <div className="grid grid-cols-7 gap-[2px] mb-1">
                    {dayNames.map(day => (
                        <div key={day} className="p-1 sm:p-2 text-center font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 text-xs sm:text-sm">{day}</div>
                    ))}
                </div>{/* Días */}
                <div className="grid grid-cols-7 gap-[2px]">
                    {calendarDays.map((day, index) => {
                        const dayEvents = getEventsForDate(day);
                        const isCurrentMonthDay = isCurrentMonth(day);
                        const isTodayDay = isToday(day);
                        const isSelected = rangeSelection
                            ? (startDate && day.getTime() === startDate.getTime()) ||
                            (endDate && day.getTime() === endDate.getTime())
                            : startDate && day.getTime() === startDate.getTime();
                        const isInSelectedRange = rangeSelection && isInRange(day);
                        const isEdge = rangeSelection && isRangeEdge(day);

                        // Clase para el día base
                        let dayClass = baseDayClass;
                        // Día fuera de mes actual
                        if (!isCurrentMonthDay) {
                            dayClass += " bg-gray-50 dark:bg-gray-900/40 text-gray-400 dark:text-gray-600";
                        } else {
                            dayClass += " bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700";
                        }
                        // Día de hoy
                        if (isTodayDay && !isSelected) {
                            dayClass += " bg-orange-100 border-orange-400 text-orange-900 ring-2 ring-orange-300 font-semibold";
                        }
                        // Día seleccionado (prioridad si además es hoy)
                        if (isSelected) {
                            if (isTodayDay) {
                                dayClass += " bg-orange-200 border-orange-600 ring-2 ring-orange-400 font-bold";
                            } else {
                                dayClass += " border-primary-500 dark:border-primary-400 ring-2 ring-primary-400 bg-primary-50 font-semibold";
                            }
                        }
                        // Rango de selección (no borde para no ensuciar)
                        if (isInSelectedRange && !isEdge) {
                            dayClass += " bg-primary-100 dark:bg-primary-900/20";
                        }
                        // Borde para los bordes de rango
                        if (isEdge && !isTodayDay) {
                            dayClass += " bg-primary-200 dark:bg-primary-800 font-bold text-primary-800 dark:text-primary-200";
                        }

                        return (
                            <div
                                key={index}
                                onClick={() => handleDateClick(day)}
                                className={dayClass}
                                style={{ minWidth: 0 }}
                            >
                                <div className="font-medium">{day.getDate()}</div>
                                {/* Eventos del día */}
                                <div className="mt-0.5 space-y-0.5">
                                    {dayEvents.slice(0, 1).map((event, eventIndex) => (
                                        <div
                                            key={eventIndex}
                                            onClick={(e) => handleEventClick(event, e)}
                                            className="text-xxs sm:text-xs px-1 py-0.5 rounded truncate bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-pointer"
                                            title={event.title}
                                        >
                                            {event.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 1 && (
                                        <div className="text-xxs sm:text-xs text-gray-500 dark:text-gray-400 px-1">
                                            +{dayEvents.length - 1} más
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
             {showFooter && (
                <div className={MODAL_CLASSES.footer}>
                    <div className="flex justify-between items-center w-full">
                        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                            {/* Mensaje según selección */}
                            {rangeSelection
                                ? (startDate && endDate
                                    ? <>Rango seleccionado: <span className="font-semibold">{startDate.toLocaleDateString()} — {endDate.toLocaleDateString()}</span></>
                                    : startDate
                                        ? <>Inicio de rango: <span className="font-semibold">{startDate.toLocaleDateString()}</span></>
                                        : "Seleccione un rango de días"
                                )
                                : startDate
                                    ? <>Día seleccionado: <span className="font-semibold">{startDate.toLocaleDateString()}</span></>
                                    : "Seleccione un día"}
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={rangeSelection ? !(startDate && endDate) : !startDate}
                                onClick={() => {
                                    if (rangeSelection) {
                                        onClose?.({ startDate, endDate });
                                    } else {
                                        onClose?.(startDate);
                                    }
                                }}
                                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} disabled:opacity-60`}
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ====================================
// MAPEO DE FUNCIONES RENDER
// ====================================

export const dataModalRenderers = {
    search: SearchModalContent,
    datatable: DataTableModalContent,
    calendar: CalendarModalContent
};

// ====================================
// EXPORT POR DEFECTO
// ====================================

export default dataModalRenderers;