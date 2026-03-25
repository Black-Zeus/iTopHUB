/**
 * types/media/ImageViewer.jsx
 * Componente avanzado para visualización de imágenes
 * Zoom, rotación, navegación, miniaturas y metadatos
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, 
  Download, Maximize2, Minimize2, Move, RotateCcw
} from 'lucide-react';

// ====================================
// COMPONENTE PRINCIPAL
// ====================================

export const ImageViewer = ({
  images = [],
  currentIndex = 0,
  showThumbnails = true,
  showMetadata = true,
  allowDownload = true,
  allowRotate = true,
  allowZoom = true,
  allowFullscreen = true,
  onNext,
  onPrevious,
  onDownload,
  onRotate
}) => {
  // ====================================
  // ESTADO LOCAL
  // ====================================
  
  const [currentImageIndex, setCurrentImageIndex] = useState(currentIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // ====================================
  // REFS
  // ====================================
  
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  
  // ====================================
  // DATOS
  // ====================================
  
  const imageList = Array.isArray(images) ? images : [images].filter(Boolean);
  const currentImage = imageList[currentImageIndex] || {};
  const hasMultipleImages = imageList.length > 1;
  
  // ====================================
  // EFECTOS
  // ====================================
  
  // Reset state when image changes
  useEffect(() => {
    setZoomLevel(1);
    setRotation(0);
    setImagePosition({ x: 0, y: 0 });
    setIsLoading(true);
    setHasError(false);
  }, [currentImageIndex]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case 'r':
          e.preventDefault();
          handleRotate();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) {
            setIsFullscreen(false);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentImageIndex, isFullscreen]);
  
  // ====================================
  // HANDLERS
  // ====================================
  
  const handleNext = useCallback(() => {
    if (currentImageIndex < imageList.length - 1) {
      const newIndex = currentImageIndex + 1;
      setCurrentImageIndex(newIndex);
      onNext?.(newIndex);
    }
  }, [currentImageIndex, imageList.length, onNext]);

  const handlePrevious = useCallback(() => {
    if (currentImageIndex > 0) {
      const newIndex = currentImageIndex - 1;
      setCurrentImageIndex(newIndex);
      onPrevious?.(newIndex);
    }
  }, [currentImageIndex, onPrevious]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleRotate = useCallback((direction = 1) => {
    const newRotation = (rotation + (90 * direction)) % 360;
    setRotation(newRotation);
    onRotate?.(newRotation);
  }, [rotation, onRotate]);

  const handleDownload = useCallback(() => {
    if (currentImage.url || currentImage.src) {
      const link = document.createElement('a');
      link.href = currentImage.url || currentImage.src;
      link.download = currentImage.name || `image-${currentImageIndex + 1}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onDownload?.(currentImage);
    }
  }, [currentImage, currentImageIndex, onDownload]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const resetView = useCallback(() => {
    setZoomLevel(1);
    setRotation(0);
    setImagePosition({ x: 0, y: 0 });
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  }, [zoomLevel, imagePosition]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging && zoomLevel > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, zoomLevel]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.max(0.25, Math.min(5, prev + delta)));
    }
  }, []);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // ====================================
  // RENDER HELPERS
  // ====================================

  const renderToolbar = () => (
    <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center space-x-3">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {currentImageIndex + 1} de {imageList.length}
        </span>
        {currentImage.name && (
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">
            {currentImage.name}
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {allowZoom && (
          <>
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.25}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title="Alejar (-)">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 5}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title="Acercar (+)">
              <ZoomIn className="w-4 h-4" />
            </button>
          </>
        )}
        
        {allowRotate && (
          <>
            <button
              onClick={() => handleRotate(-1)}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Rotar izquierda">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleRotate(1)}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Rotar derecha (R)">
              <RotateCw className="w-4 h-4" />
            </button>
          </>
        )}

        <button
          onClick={resetView}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs px-3"
          title="Restablecer vista">
          Reset
        </button>
        
        {allowFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Pantalla completa (F)">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
        
        {allowDownload && (
          <button
            onClick={handleDownload}
            className="p-2 rounded bg-primary-600 hover:bg-primary-700 text-white transition-colors"
            title="Descargar">
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  const renderNavigationButtons = () => hasMultipleImages && (
    <>
      <button
        onClick={handlePrevious}
        disabled={currentImageIndex === 0}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        title="Imagen anterior (←)">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={handleNext}
        disabled={currentImageIndex === imageList.length - 1}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        title="Imagen siguiente (→)">
        <ChevronRight className="w-6 h-6" />
      </button>
    </>
  );

  const renderImage = () => {
    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center text-gray-400 p-8">
          <div className="w-16 h-16 border-2 border-gray-300 rounded-lg flex items-center justify-center mb-4">
            <span className="text-2xl">🖼️</span>
          </div>
          <p className="text-lg font-medium mb-2">Error al cargar la imagen</p>
          <p className="text-sm">Verifique que la URL sea correcta</p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Cargando imagen...</span>
        </div>
      );
    }

    return (
      <img
        ref={imageRef}
        src={currentImage.url || currentImage.src}
        alt={currentImage.alt || currentImage.name || 'Imagen'}
        className={`max-w-none object-contain transition-transform duration-200 ${isDragging ? 'cursor-grabbing' : zoomLevel > 1 ? 'cursor-grab' : 'cursor-default'}`}
        style={{
          transform: `scale(${zoomLevel}) rotate(${rotation}deg) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
          maxHeight: zoomLevel === 1 ? '70vh' : 'none',
          maxWidth: zoomLevel === 1 ? '100%' : 'none'
        }}
        onLoad={handleImageLoad}
        onError={handleImageError}
        onMouseDown={handleMouseDown}
        draggable={false}
      />
    );
  };

  const renderThumbnails = () => showThumbnails && hasMultipleImages && (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        {imageList.map((image, index) => (
          <button
            key={index}
            onClick={() => setCurrentImageIndex(index)}
            className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all ${
              index === currentImageIndex 
                ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800 scale-105' 
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:scale-105'
            }`}
          >
            {image.url || image.src ? (
              <img
                src={image.url || image.src}
                alt={`Miniatura ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-2xl">🖼️</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const renderMetadata = () => showMetadata && currentImage && (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div className="grid grid-cols-2 gap-4 text-sm">
        {currentImage.size && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">Tamaño:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">{currentImage.size}</span>
          </div>
        )}
        {currentImage.dimensions && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">Dimensiones:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">{currentImage.dimensions}</span>
          </div>
        )}
        {currentImage.format && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">Formato:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">{currentImage.format}</span>
          </div>
        )}
        {currentImage.date && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">Fecha:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">
              {new Date(currentImage.date).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  // ====================================
  // RENDER PRINCIPAL
  // ====================================

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-[9999] bg-black' : ''}`}>
      {/* Toolbar */}
      {renderToolbar()}

      {/* Main image area */}
      <div 
        ref={containerRef}
        className="relative bg-gray-900 flex items-center justify-center flex-1 overflow-hidden"
        style={{ minHeight: isFullscreen ? '80vh' : '400px' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Navigation buttons */}
        {renderNavigationButtons()}

        {/* Image */}
        <div className="flex items-center justify-center w-full h-full">
          {renderImage()}
        </div>

        {/* Zoom indicator */}
        {zoomLevel > 1 && (
          <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-sm">
            {Math.round(zoomLevel * 100)}% {zoomLevel > 1 && <Move className="inline w-3 h-3 ml-1" />}
          </div>
        )}

        {/* Keyboard shortcuts help */}
        <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-2 rounded text-xs opacity-70 hover:opacity-100 transition-opacity">
          <div>← → Navegar</div>
          <div>+/- Zoom</div>
          <div>R Rotar</div>
          <div>F Pantalla completa</div>
        </div>
      </div>

      {/* Thumbnails */}
      {!isFullscreen && renderThumbnails()}

      {/* Metadata */}
      {!isFullscreen && renderMetadata()}
    </div>
  );
};

export default ImageViewer;