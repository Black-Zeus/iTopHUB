/**
 * types/MediaModals.jsx
 * Modales de multimedia: image, video, gallery, filemanager
 * VERSIÓN OPTIMIZADA - Solo exports y funciones principales
 */

import React from 'react';
import { MODAL_CLASSES } from '../modalTypes.js';

// Importar componentes específicos
import { ImageViewer } from './media/ImageViewer.jsx';
import { VideoPlayer } from './media/VideoPlayer.jsx';
import { GalleryGrid } from './media/GalleryGrid.jsx';
import { FileManager } from './media/FileManager.jsx';

// ====================================
// MODAL DE IMAGEN
// ====================================

export const renderImageModal = ({
  type = 'image',
  title,
  images = [],
  currentIndex = 0,
  showThumbnails = true,
  showMetadata = true,
  allowDownload = true,
  allowRotate = true,
  allowZoom = true,
  onClose,
  onNext,
  onPrevious,
  onDownload,
  onRotate
}) => {
  return (
    <>
      {/* Body */}
      <div className={`${MODAL_CLASSES.bodyContent} p-0`}>
        <ImageViewer
          images={images}
          currentIndex={currentIndex}
          showThumbnails={showThumbnails}
          showMetadata={showMetadata}
          allowDownload={allowDownload}
          allowRotate={allowRotate}
          allowZoom={allowZoom}
          onNext={onNext}
          onPrevious={onPrevious}
          onDownload={onDownload}
          onRotate={onRotate}
        />
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-between w-full">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {images.length} imagen(es)
          </div>
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
// MODAL DE VIDEO
// ====================================

export const renderVideoModal = ({
  type = 'video',
  title,
  video,
  videos = [],
  currentIndex = 0,
  autoplay = false,
  controls = true,
  volume = 1,
  showPlaylist = true,
  onClose,
  onPlay,
  onPause,
  onEnded,
  onVolumeChange,
  onProgress
}) => {
  return (
    <>
      {/* Body */}
      <div className={`${MODAL_CLASSES.bodyContent} p-0`}>
        <VideoPlayer
          video={video}
          videos={videos}
          currentIndex={currentIndex}
          autoplay={autoplay}
          controls={controls}
          volume={volume}
          showPlaylist={showPlaylist}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          onVolumeChange={onVolumeChange}
          onProgress={onProgress}
        />
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-between w-full">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {videos.length || 1} video(s)
          </div>
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
// MODAL DE GALERÍA
// ====================================

export const renderGalleryModal = ({
  type = 'gallery',
  title,
  items = [],
  viewMode = 'grid',
  allowUpload = true,
  allowDelete = true,
  allowEdit = true,
  selectable = true,
  onClose,
  onItemSelect,
  onItemOpen,
  onUpload,
  onDelete,
  onEdit
}) => {
  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        <GalleryGrid
          items={items}
          viewMode={viewMode}
          allowUpload={allowUpload}
          allowDelete={allowDelete}
          allowEdit={allowEdit}
          selectable={selectable}
          onItemSelect={onItemSelect}
          onItemOpen={onItemOpen}
          onUpload={onUpload}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-between w-full">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {items.length} elemento(s)
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE GESTOR DE ARCHIVOS
// ====================================

export const renderFileManagerModal = ({
  type = 'filemanager',
  title,
  currentPath = '/',
  files = [],
  allowUpload = true,
  allowCreateFolder = true,
  allowDelete = true,
  allowRename = true,
  allowMove = true,
  onClose,
  onNavigate,
  onFileSelect,
  onUpload,
  onCreateFolder,
  onDelete,
  onRename,
  onMove
}) => {
  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        <FileManager
          currentPath={currentPath}
          files={files}
          allowUpload={allowUpload}
          allowCreateFolder={allowCreateFolder}
          allowDelete={allowDelete}
          allowRename={allowRename}
          allowMove={allowMove}
          onNavigate={onNavigate}
          onFileSelect={onFileSelect}
          onUpload={onUpload}
          onCreateFolder={onCreateFolder}
          onDelete={onDelete}
          onRename={onRename}
          onMove={onMove}
        />
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-between w-full">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {files.length} elemento(s)
          </div>
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
// MAPEO DE FUNCIONES RENDER
// ====================================

export const mediaModalRenderers = {
  image: renderImageModal,
  video: renderVideoModal,
  gallery: renderGalleryModal,
  filemanager: renderFileManagerModal
};

// ====================================
// EXPORT POR DEFECTO
// ====================================

export default mediaModalRenderers;