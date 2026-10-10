import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "@/components/ui/icons";
import { formatTime } from "./videoTime";
import type { useVideoPlayback } from "./useVideoPlayback";

export function VideoControls({
  playback,
}: {
  playback: ReturnType<typeof useVideoPlayback>;
}) {
  const {
    videoRef,
    playing,
    current,
    setCurrent,
    duration,
    muted,
    volume,
    isFullscreen,
    revealControls,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    onProgressPointerDown,
    progress,
  } = playback;
  return (
    <div className="goose-video-player__chrome">
      <div className="goose-video-player__gradient" aria-hidden="true" />

      <div
        className="goose-video-player__progress"
        role="slider"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration) || 0}
        aria-valuenow={Math.floor(current)}
        aria-valuetext={`${formatTime(current)} / ${formatTime(duration)}`}
        tabIndex={0}
        onPointerDown={onProgressPointerDown}
        onKeyDown={(e) => {
          const video = videoRef.current;
          if (!video || !duration) return;
          const step = e.shiftKey ? 10 : 5;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - step);
            setCurrent(video.currentTime);
            revealControls();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            video.currentTime = Math.min(duration, video.currentTime + step);
            setCurrent(video.currentTime);
            revealControls();
          }
        }}
      >
        <div className="goose-video-player__progress-track">
          <div
            className="goose-video-player__progress-fill"
            style={{ width: `${progress}%` }}
          />
          <div
            className="goose-video-player__progress-thumb"
            style={{ left: `${progress}%` }}
          />
        </div>
      </div>

      <div className="goose-video-player__bar">
        <div className="goose-video-player__bar-left">
          <button
            type="button"
            className="goose-video-player__btn"
            aria-label={playing ? "暂停" : "播放"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              void togglePlay();
            }}
          >
            {playing ? (
              <Pause size={16} strokeWidth={1.75} />
            ) : (
              <Play
                size={16}
                strokeWidth={1.75}
                className="goose-video-player__icon-play"
              />
            )}
          </button>

          <button
            type="button"
            className="goose-video-player__btn"
            aria-label={muted || volume === 0 ? "取消静音" : "静音"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
          >
            {muted || volume === 0 ? (
              <VolumeX size={16} strokeWidth={1.75} />
            ) : (
              <Volume2 size={16} strokeWidth={1.75} />
            )}
          </button>

          <span className="goose-video-player__time">
            {formatTime(current)}
            <span className="goose-video-player__time-sep">/</span>
            {formatTime(duration)}
          </span>
        </div>

        <div className="goose-video-player__bar-right">
          <button
            type="button"
            className="goose-video-player__btn"
            aria-label={isFullscreen ? "退出全屏" : "全屏"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              void toggleFullscreen();
            }}
          >
            {isFullscreen ? (
              <Minimize2 size={16} strokeWidth={1.75} />
            ) : (
              <Maximize2 size={16} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
