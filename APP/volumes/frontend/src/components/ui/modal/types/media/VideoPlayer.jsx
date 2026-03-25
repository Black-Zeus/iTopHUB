/**
* types/media/VideoPlayer.jsx
* Reproductor de video avanzado con controles personalizados
* Playlist, subtítulos, velocidad, pantalla completa
*/

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Play, Pause, Square, Volume2, VolumeX, Maximize2, Minimize2,
    SkipForward, SkipBack, MoreHorizontal, Settings, Download,
    Repeat, Shuffle, List, Captions
} from 'lucide-react';

// ====================================
// COMPONENTE PRINCIPAL
// ====================================

export const VideoPlayer = ({
    video,
    videos = [],
    currentIndex = 0,
    autoplay = false,
    controls = true,
    volume = 1,
    playbackRate = 1,
    showPlaylist = true,
    showSubtitles = false,
    subtitles = [],
    allowDownload = true,
    allowFullscreen = true,
    onPlay,
    onPause,
    onEnded,
    onVolumeChange,
    onProgress,
    onPlaybackRateChange
}) => {
    // ====================================
    // ESTADO LOCAL
    // ====================================

    const [isPlaying, setIsPlaying] = useState(autoplay);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [currentVolume, setCurrentVolume] = useState(volume);
    const [isMuted, setIsMuted] = useState(false);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(currentIndex);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [currentPlaybackRate, setCurrentPlaybackRate] = useState(playbackRate);
    const [showSettings, setShowSettings] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [currentSubtitle, setCurrentSubtitle] = useState(null);
    const [showSubtitlesMenu, setShowSubtitlesMenu] = useState(false);

    // ====================================
    // REFS
    // ====================================

    const videoRef = useRef(null);
    const progressRef = useRef(null);
    const containerRef = useRef(null);
    const controlsTimeoutRef = useRef(null);

    // ====================================
    // DATOS
    // ====================================

    const videoList = videos.length > 0 ? videos : [video].filter(Boolean);
    const currentVideo = videoList[currentVideoIndex] || {};
    const hasMultipleVideos = videoList.length > 1;

    const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    // ====================================
    // EFECTOS
    // ====================================

    // Video event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            onProgress?.(video.currentTime, video.duration);

            // Update subtitles
            if (showSubtitles && subtitles.length > 0) {
                const currentSub = subtitles.find(sub =>
                    video.currentTime >= sub.start && video.currentTime <= sub.end
                );
                setCurrentSubtitle(currentSub?.text || null);
            }
        };

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
            setIsLoading(false);
        };

        const handleProgress = () => {
            if (video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const duration = video.duration;
                setBuffered((bufferedEnd / duration) * 100);
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            onEnded?.();

            // Auto-next in playlist
            if (hasMultipleVideos && currentVideoIndex < videoList.length - 1) {
                setTimeout(() => handleNext(), 1000);
            }
        };

        const handleLoadStart = () => setIsLoading(true);
        const handleError = () => {
            setHasError(true);
            setIsLoading(false);
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('progress', handleProgress);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('loadstart', handleLoadStart);
        video.addEventListener('error', handleError);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('progress', handleProgress);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('loadstart', handleLoadStart);
            video.removeEventListener('error', handleError);
        };
    }, [showSubtitles, subtitles, onProgress, onEnded, hasMultipleVideos, currentVideoIndex, videoList.length]);

    // ✅ NUEVO: Cleanup de video al desmontar componente
    useEffect(() => {
        return () => {
            const video = videoRef.current;
            if (video) {
                video.pause();
                video.currentTime = 0;
                video.src = '';
                video.load(); // Liberar recursos
            }
        };
    }, []);

    // ✅ NUEVO: Cleanup al cambiar de video
    useEffect(() => {
        const video = videoRef.current;
        if (video && currentVideo.url) {
            // Pausar video anterior antes de cambiar
            video.pause();
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
            setHasError(false);
            setIsLoading(true);
        }
    }, [currentVideoIndex, currentVideo.url]);

    // Controls auto-hide
    useEffect(() => {
        if (isPlaying && isFullscreen) {
            const hideControls = () => {
                controlsTimeoutRef.current = setTimeout(() => {
                    setShowControls(false);
                }, 3000);
            };

            hideControls();

            return () => {
                if (controlsTimeoutRef.current) {
                    clearTimeout(controlsTimeoutRef.current);
                }
            };
        } else {
            setShowControls(true);
        }
    }, [isPlaying, isFullscreen]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.target.tagName === 'INPUT') return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    handlePlayPause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    handleSkip(-10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    handleSkip(10);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    handleVolumeChange(Math.min(1, currentVolume + 0.1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    handleVolumeChange(Math.max(0, currentVolume - 0.1));
                    break;
                case 'm':
                    e.preventDefault();
                    handleMute();
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'c':
                    e.preventDefault();
                    setShowSubtitles(prev => !prev);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentVolume]);

    // ====================================
    // HANDLERS
    // ====================================
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = currentVolume;
            videoRef.current.playbackRate = currentPlaybackRate;
        }
    }, [currentVolume, currentPlaybackRate]);


    const handlePlayPause = useCallback(() => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                onPause?.();
            } else {
                videoRef.current.play();
                onPlay?.();
            }
            setIsPlaying(!isPlaying);
        }
    }, [isPlaying, onPlay, onPause]);

    const handleVolumeChange = useCallback((newVolume) => {
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            setCurrentVolume(newVolume);
            setIsMuted(newVolume === 0);
            onVolumeChange?.(newVolume);
        }
    }, [onVolumeChange]);

    const handleMute = useCallback(() => {
        if (isMuted) {
            handleVolumeChange(currentVolume > 0 ? currentVolume : 0.5);
        } else {
            handleVolumeChange(0);
        }
    }, [isMuted, currentVolume, handleVolumeChange]);

    const handleProgressClick = useCallback((e) => {
        if (progressRef.current && videoRef.current) {
            const rect = progressRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = clickX / rect.width;
            const newTime = percentage * duration;

            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    }, [duration]);

    const handleSkip = useCallback((seconds) => {
        if (videoRef.current) {
            const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    }, [currentTime, duration]);

    const handlePlaybackRateChange = useCallback((rate) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = rate;
            setCurrentPlaybackRate(rate);
            onPlaybackRateChange?.(rate);
        }
    }, [onPlaybackRateChange]);

    const handleNext = useCallback(() => {
        if (currentVideoIndex < videoList.length - 1) {
            const newIndex = currentVideoIndex + 1;
            setCurrentVideoIndex(newIndex);
            setHasError(false);
        }
    }, [currentVideoIndex, videoList.length]);

    const handlePrevious = useCallback(() => {
        if (currentVideoIndex > 0) {
            const newIndex = currentVideoIndex - 1;
            setCurrentVideoIndex(newIndex);
            setHasError(false);
        }
    }, [currentVideoIndex]);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    const handleMouseMove = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
    }, []);

    const formatTime = useCallback((time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    // ====================================
    // RENDER HELPERS
    // ====================================

    const renderVideo = () => {
        if (hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <div className="w-16 h-16 border-2 border-gray-300 rounded-lg flex items-center justify-center mb-4">
                        <span className="text-2xl">🎬</span>
                    </div>
                    <p className="text-lg font-medium mb-2">Error al cargar el video</p>
                    <p className="text-sm">Verifique que la URL sea correcta</p>
                    <button
                        onClick={() => {
                            setHasError(false);
                            setIsLoading(true);
                        }}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            );
        }

        return (
            <video
                ref={videoRef}
                src={currentVideo.url || currentVideo.src}
                className="w-full h-auto object-contain"
                poster={currentVideo.poster}
                muted={isMuted}
                //volume={currentVolume}
                //playbackRate={currentPlaybackRate}
                onClick={handlePlayPause}
            />
        );
    };

    const renderControls = () => (
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            {/* Progress bar */}
            <div
                ref={progressRef}
                onClick={handleProgressClick}
                className="w-full h-2 bg-white/20 rounded-full cursor-pointer mb-4 relative group"
            >
                {/* Buffered */}
                <div
                    className="absolute h-full bg-white/30 rounded-full"
                    style={{ width: `${buffered}%` }}
                />
                {/* Progress */}
                <div
                    className="absolute h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
                {/* Hover indicator */}
                <div className="absolute -top-1 w-4 h-4 bg-primary-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, transform: 'translateX(-50%)' }} />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between text-white">
                <div className="flex items-center space-x-4">
                    {/* Play/Pause */}
                    <button
                        onClick={handlePlayPause}
                        className="hover:text-primary-400 transition-colors"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : isPlaying ? (
                            <Pause className="w-6 h-6" />
                        ) : (
                            <Play className="w-6 h-6" />
                        )}
                    </button>

                    {/* Skip buttons */}
                    <button
                        onClick={() => handleSkip(-10)}
                        className="hover:text-primary-400 transition-colors"
                        title="Retroceder 10s"
                    >
                        <SkipBack className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => handleSkip(10)}
                        className="hover:text-primary-400 transition-colors"
                        title="Avanzar 10s"
                    >
                        <SkipForward className="w-5 h-5" />
                    </button>

                    {/* Volume controls */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleMute}
                            className="hover:text-primary-400 transition-colors"
                        >
                            {isMuted || currentVolume === 0 ? (
                                <VolumeX className="w-5 h-5" />
                            ) : (
                                <Volume2 className="w-5 h-5" />
                            )}
                        </button>

                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={isMuted ? 0 : currentVolume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            className="w-20 accent-primary-500"
                        />
                    </div>

                    {/* Time display */}
                    <span className="text-sm whitespace-nowrap">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>

                <div className="flex items-center space-x-2">
                    {/* Playlist navigation */}
                    {hasMultipleVideos && (
                        <>
                            <button
                                onClick={handlePrevious}
                                disabled={currentVideoIndex === 0}
                                className="hover:text-primary-400 transition-colors disabled:opacity-50"
                                title="Video anterior"
                            >
                                <SkipBack className="w-5 h-5" />
                            </button>

                            <button
                                onClick={handleNext}
                                disabled={currentVideoIndex === videoList.length - 1}
                                className="hover:text-primary-400 transition-colors disabled:opacity-50"
                                title="Video siguiente"
                            >
                                <SkipForward className="w-5 h-5" />
                            </button>
                        </>
                    )}

                    {/* Subtitles */}
                    {subtitles.length > 0 && (
                        <button
                            onClick={() => setShowSubtitles(prev => !prev)}
                            className={`hover:text-primary-400 transition-colors ${showSubtitles ? 'text-primary-400' : ''}`}
                            title="Subtítulos (C)"
                        >
                            <Captions className="w-5 h-5" />
                        </button>
                    )}

                    {/* Settings */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSettings(prev => !prev)}
                            className="hover:text-primary-400 transition-colors"
                            title="Configuración"
                        >
                            <Settings className="w-5 h-5" />
                        </button>

                        {showSettings && (
                            <div className="absolute bottom-8 right-0 bg-black/90 backdrop-blur-sm rounded-lg p-3 min-w-[150px]">
                                <div className="space-y-2">
                                    <div>
                                        <div className="text-xs text-gray-300 mb-1">Velocidad</div>
                                        {playbackRates.map(rate => (
                                            <button
                                                key={rate}
                                                onClick={() => {
                                                    handlePlaybackRateChange(rate);
                                                    setShowSettings(false);
                                                }}
                                                className={`block w-full text-left px-2 py-1 text-sm rounded hover:bg-white/10 ${rate === currentPlaybackRate ? 'text-primary-400' : ''
                                                    }`}
                                            >
                                                {rate}x {rate === 1 && '(Normal)'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Download */}
                    {allowDownload && (
                        <button
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = currentVideo.url || currentVideo.src;
                                link.download = currentVideo.title || `video-${currentVideoIndex + 1}`;
                                link.click();
                            }}
                            className="hover:text-primary-400 transition-colors"
                            title="Descargar"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    )}

                    {/* Fullscreen */}
                    {allowFullscreen && (
                        <button
                            onClick={toggleFullscreen}
                            className="hover:text-primary-400 transition-colors"
                            title="Pantalla completa (F)"
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-5 h-5" />
                            ) : (
                                <Maximize2 className="w-5 h-5" />
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    const renderSubtitles = () => showSubtitles && currentSubtitle && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded text-center max-w-4xl">
            {currentSubtitle}
        </div>
    );

    const renderVideoInfo = () => currentVideo && !isFullscreen && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {currentVideo.title || currentVideo.name || 'Video'}
            </h3>
            {currentVideo.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentVideo.description}
                </p>
            )}
        </div>
    );

    const renderPlaylist = () => showPlaylist && hasMultipleVideos && !isFullscreen && (
        <div className="p-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                <List className="w-4 h-4 mr-2" />
                Lista de reproducción ({videoList.length} videos)
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
                {videoList.map((video, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentVideoIndex(index)}
                        className={`w-full flex items-center p-2 rounded border transition-colors text-left ${index === currentVideoIndex
                                ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                    >
                        <div className="w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded mr-3 flex items-center justify-center flex-shrink-0">
                            <Play className="w-3 h-3 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {video.title || video.name || `Video ${index + 1}`}
                            </div>
                            {video.duration && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {video.duration}
                                </div>
                            )}
                        </div>
                        {index === currentVideoIndex && (
                            <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );

    // ====================================
    // RENDER PRINCIPAL
    // ====================================

    return (
        <div className={isFullscreen ? 'fixed inset-0 z-[9999] bg-black' : ''}>
            {/* Video container */}
            <div
                ref={containerRef}
                className="relative bg-black"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setShowControls(false)}
            >
                {renderVideo()}

                {/* Loading overlay */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="text-white text-center">
                            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <div className="text-sm">Cargando video...</div>
                        </div>
                    </div>
                )}

                {/* Controls overlay */}
                {controls && renderControls()}

                {/* Subtitles */}
                {renderSubtitles()}

                {/* Click to play overlay */}
                {!isPlaying && !isLoading && !hasError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <button
                            onClick={handlePlayPause}
                            className="w-20 h-20 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all hover:scale-110"
                        >
                            <Play className="w-8 h-8 text-white ml-1" />
                        </button>
                    </div>
                )}
            </div>

            {/* Video info */}
            {renderVideoInfo()}

            {/* Playlist */}
            {renderPlaylist()}
        </div>
    );
};

export default VideoPlayer;