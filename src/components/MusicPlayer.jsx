import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import * as jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';
import './MusicPlayer.css';

const musicFiles = import.meta.glob('/src/assets/music/*.mp3', { eager: true, import: 'default' });

const tracks = Object.keys(musicFiles).map((path) => {
  // Extract filename from path (e.g., "/src/assets/music/Song Name.mp3" -> "Song Name")
  const fileName = path.split('/').pop().replace('.mp3', '');
  return {
    title: fileName,
    src: musicFiles[path]
  };
});

export default function MusicPlayer() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [metadata, setMetadata] = useState(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(true);
  const [showRemainingTime, setShowRemainingTime] = useState(true);

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);

  // Refs for keyboard handling
  const isLongPress = useRef(false);
  const longPressTimer = useRef(null);
  const rewindInterval = useRef(null);
  const speedUpInterval = useRef(null);
  const volumeInterval = useRef(null);
  const isKeyDown = useRef({ ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false });
  const prevCoverRef = useRef(null);

  const currentTrack = tracks[currentTrackIndex];

  useEffect(() => {
    setCurrentTime(0);
    setIsMetadataLoading(true);
    // Capture current cover as previous before fetching new one
    if (metadata?.cover) {
      prevCoverRef.current = metadata.cover;
    }
    // NOTE: We intentionally DO NOT reset metadata to null here
    // to allow the old cover to persist until the new one overrides it.

    const fetchMetadata = async () => {
      if (!window.jsmediatags) {
         setIsMetadataLoading(false);
         return;
      }

      try {
        const response = await fetch(currentTrack.src);
        const blob = await response.blob();
        
        const file = new File([blob], `${currentTrack.title}.mp3`, { type: blob.type });

        new window.jsmediatags.Reader(file)
          .read({
            onSuccess: (tag) => {
              const tags = tag.tags;
              let cover = null;
              if (tags.picture) {
                const { data, format } = tags.picture;
                let base64String = "";
                for (let i = 0; i < data.length; i++) {
                  base64String += String.fromCharCode(data[i]);
                }
                cover = `data:${format};base64,${window.btoa(base64String)}`;
              }
              setMetadata({
                artist: tags.artist || 'Unknown Artist',
                cover: cover
              });
              setIsMetadataLoading(false);
            },
            onError: (error) => {
              console.error("Metadata extraction failed:", error);
              // Only reset if we fail, to ensure we don't show stale data forever
              setMetadata({ artist: 'Unknown Artist', cover: null });
              setIsMetadataLoading(false);
            }
          });
      } catch (error) {
        console.error("Error fetching track for metadata:", error);
        setMetadata({ artist: 'Unknown Artist', cover: null });
        setIsMetadataLoading(false);
      }
    };
    
    fetchMetadata();
  }, [currentTrackIndex]);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current.play().catch(e => console.error("Playback failed:", e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrackIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    setDuration(audioRef.current.duration);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrev = () => {
    setCurrentTrackIndex((prev) => (prev === 0 ? tracks.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentTrackIndex((prev) => (prev === tracks.length - 1 ? 0 : prev + 1));
  };

  const handleProgressClick = (e) => {
    const progressBar = progressBarRef.current;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeClick = (e) => {
    const volumeBar = volumeBarRef.current;
    const rect = volumeBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newVolume = Math.max(0, Math.min(1, clickX / width));
    
    setVolume(newVolume);
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPreviousVolume(volume);
      setVolume(0);
    } else {
      setVolume(previousVolume || 0.5);
    }
  };

  const toggleTimeDisplay = () => {
    setShowRemainingTime(prev => !prev);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatRemainingTime = (time, duration) => {
      if (isNaN(time) || isNaN(duration)) return '-0:00';
      const remaining = duration - time;
      const minutes = Math.floor(remaining / 60);
      const seconds = Math.floor(remaining % 60);
      return `-${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  const handleTrackEnd = () => {
      handleNext();
      setIsPlaying(true);
  };

  // Keyboard shortcuts with Tap/Hold logic
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return; // Ignore repeat events for logic triggering

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (!isKeyDown.current.ArrowLeft) {
            isKeyDown.current.ArrowLeft = true;
            longPressTimer.current = setTimeout(() => {
              isLongPress.current = true;
              // Rewind simulation (approx 2x speed)
              rewindInterval.current = setInterval(() => {
                if (audioRef.current) {
                   audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 0.2);
                }
              }, 100);
            }, 200);
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (!isKeyDown.current.ArrowRight) {
            isKeyDown.current.ArrowRight = true;
            longPressTimer.current = setTimeout(() => {
              isLongPress.current = true;
              // Gradual speed increase
              speedUpInterval.current = setInterval(() => {
                  if (audioRef.current) {
                      // Increase rate by 0.2 every 100ms, max 4.0x
                      audioRef.current.playbackRate = Math.min(audioRef.current.playbackRate + 0.2, 16.0);
                  }
              }, 100);
            }, 200);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (!isKeyDown.current.ArrowUp) {
            clearInterval(volumeInterval.current); // Stop any existing volume change
            isKeyDown.current.ArrowUp = true;
            setVolume((prev) => Math.min(prev + 0.05, 1));
            volumeInterval.current = setInterval(() => {
              setVolume((prev) => Math.min(prev + 0.05, 1));
            }, 100);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (!isKeyDown.current.ArrowDown) {
            clearInterval(volumeInterval.current); // Stop any existing volume change
            isKeyDown.current.ArrowDown = true;
            setVolume((prev) => Math.max(prev - 0.05, 0));
            volumeInterval.current = setInterval(() => {
              setVolume((prev) => Math.max(prev - 0.05, 0));
            }, 100);
          }
          break;

        case ' ':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;

        default:
          break;
      }
    };

    const handleKeyUp = (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          clearTimeout(longPressTimer.current);
          clearInterval(rewindInterval.current);
          isKeyDown.current.ArrowLeft = false;

          if (isLongPress.current) {
            isLongPress.current = false;
          } else {
            // Tap detected
            handlePrev();
          }
          break;

        case 'ArrowRight':
          clearTimeout(longPressTimer.current);
          clearInterval(speedUpInterval.current);
          isKeyDown.current.ArrowRight = false;

          if (isLongPress.current) {
            // Was holding, reset speed
            if (audioRef.current) audioRef.current.playbackRate = 1.0;
            isLongPress.current = false;
          } else {
            // Tap detected
            handleNext();
          }
          break;

        case 'ArrowUp':
        case 'ArrowDown':
          clearInterval(volumeInterval.current);
          isKeyDown.current.ArrowUp = false;
          isKeyDown.current.ArrowDown = false;
          break;
          
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearTimeout(longPressTimer.current);
      clearInterval(rewindInterval.current);
      clearInterval(speedUpInterval.current);
      clearInterval(volumeInterval.current);
    };
  }, []);

  // Determine background image for avatar (fallback logic)
  const avatarImage = !isMetadataLoading && metadata?.cover 
    ? `url(${metadata.cover})` 
    : 'linear-gradient(135deg, #444, #222)';

  return (
    <div className="player-card">
      {/* Background Layers for Smooth Transition */}
      <div className="player-bg-default"></div>
      
      {/* Previous Cover (Stays visible while new one animates in) */}
      {prevCoverRef.current && (
          <div 
            className="player-bg-prev"
            style={{ backgroundImage: `url(${prevCoverRef.current})` }}
          ></div>
      )}

      {/* New Cover (Animates in) */}
      <div 
        key={metadata?.cover || 'default-art'}
        className="player-bg-art" 
        style={{ 
          backgroundImage: metadata?.cover ? `url(${metadata.cover})` : 'none'
        }}
      ></div>
      
      <div className="overlay"></div>
      
      {/* Top Section: Artist Pill & Actions */}
      <div className="top-bar">
          <div className="artist-pill">
              <div className="artist-avatar" style={{ backgroundImage: avatarImage }}></div>
              <div className="artist-text">
                  <span className="artist-name">{isMetadataLoading ? 'Loading...' : (metadata?.artist || 'Unknown Artist')}</span>
                  <span className="artist-handle">@{isMetadataLoading ? '...' : (metadata?.artist?.replace(/\s/g, '').toLowerCase() || 'artist')}</span>
              </div>
          </div>
      </div>

      {/* Middle Section: Spacer for Visuals */}
      <div className="visual-spacer"></div>

      {/* Bottom Section: Progress & Controls */}
      <div className="bottom-controls">
          <div className="progress-section">
              <span className="time-text">{formatTime(currentTime)}</span>
              <div 
                  className="progress-bar" 
                  ref={progressBarRef} 
                  onClick={handleProgressClick}
              >
                  <div 
                  className="progress-fill" 
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                  ></div>
              </div>
              <span 
                className="time-text" 
                onClick={toggleTimeDisplay}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {showRemainingTime ? formatRemainingTime(currentTime, duration) : formatTime(duration)}
              </span>
          </div>

          {/* Volume Slider Custom */}
          <div className="volume-section-custom">
             <div className="volume-side-element">
                 <button className="icon-btn-transparent" onClick={handleMuteToggle}>
                     {volume === 0 ? <VolumeX size={20} color="white" className="volume-icon" /> : <Volume2 size={20} color="white" className="volume-icon" />}
                 </button>
             </div>
             <div 
               className="volume-bar-custom" 
               ref={volumeBarRef}
               onClick={handleVolumeClick}
             >
                <div 
                  className="volume-fill-custom" 
                  style={{ width: `${volume * 100}%` }}
                ></div>
             </div>
             <div className="volume-side-element"></div> 
          </div>

          <div className="control-buttons">
              <button className="control-btn secondary" onClick={handlePrev}>
                  <SkipBack size={32} fill="white" stroke="none" />
              </button>
              
              <button className="control-btn primary" onClick={handlePlayPause}>
                  {isPlaying ? <Pause size={42} fill="white" stroke="none" /> : <Play size={42} fill="white" stroke="none" />}
              </button>
              
              <button className="control-btn secondary" onClick={handleNext}>
                  <SkipForward size={32} fill="white" stroke="none" />
              </button>
          </div>
      </div>

      <audio 
        ref={audioRef} 
        src={currentTrack.src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleTrackEnd}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
    </div>
  );
}
