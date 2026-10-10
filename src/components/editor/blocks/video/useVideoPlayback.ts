import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export function useVideoPlayback(src: string) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [seeking, setSeeking] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setReady(false);
    setLoadError(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (!playing) return;
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 2200);
  }, [clearHideTimer, playing]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      setControlsVisible(true);
      clearHideTimer();
    };
    const onTime = () => {
      if (!seeking) setCurrent(video.currentTime);
    };
    const onMeta = () => {
      setDuration(video.duration || 0);
      setReady(true);
      setLoadError(false);
    };
    const onVolume = () => {
      setMuted(video.muted);
      setVolume(video.volume);
    };
    const onEnded = () => {
      setPlaying(false);
      setControlsVisible(true);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("ended", onEnded);
    };
  }, [clearHideTimer, seeking, src]);

  useEffect(() => {
    const onFsChange = () => {
      const el = rootRef.current;
      setIsFullscreen(Boolean(el && document.fullscreenElement === el));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    revealControls();
    try {
      if (video.paused) await video.play();
      else video.pause();
    } catch {
      // 自动播放策略等：忽略
    }
  }, [revealControls]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) {
      video.volume = 0.9;
    }
    revealControls();
  }, [revealControls]);

  const toggleFullscreen = useCallback(async () => {
    const root = rootRef.current;
    if (!root) return;
    try {
      if (document.fullscreenElement === root) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch {
      // 宿主环境可能禁用全屏
    }
    revealControls();
  }, [revealControls]);

  const seekToClientX = useCallback(
    (clientX: number, target: HTMLElement) => {
      const video = videoRef.current;
      if (!video || !duration) return;
      const rect = target.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width),
      );
      const next = ratio * duration;
      video.currentTime = next;
      setCurrent(next);
    },
    [duration],
  );

  const onProgressPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const track = event.currentTarget;
      setSeeking(true);
      seekToClientX(event.clientX, track);
      track.setPointerCapture(event.pointerId);

      const onMove = (e: PointerEvent) => seekToClientX(e.clientX, track);
      const onUp = (e: PointerEvent) => {
        setSeeking(false);
        seekToClientX(e.clientX, track);
        track.releasePointerCapture(e.pointerId);
        track.removeEventListener("pointermove", onMove);
        track.removeEventListener("pointerup", onUp);
        track.removeEventListener("pointercancel", onUp);
        revealControls();
      };
      track.addEventListener("pointermove", onMove);
      track.addEventListener("pointerup", onUp);
      track.addEventListener("pointercancel", onUp);
    },
    [revealControls, seekToClientX],
  );

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return {
    rootRef,
    videoRef,
    playing,
    setPlaying,
    current,
    setCurrent,
    duration,
    muted,
    volume,
    controlsVisible,
    setControlsVisible,
    isFullscreen,
    ready,
    setReady,
    loadError,
    setLoadError,
    revealControls,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    onProgressPointerDown,
    progress,
  };
}
