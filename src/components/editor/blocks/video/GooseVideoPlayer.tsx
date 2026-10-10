import { Pause, Play, VideoOff } from "@/components/ui/icons";
import { cn } from "@/components/editor/utils/cn";
import { useVideoPlayback } from "./useVideoPlayback";
import { VideoControls } from "./VideoControls";
import type { GooseVideoPlayerProps } from "./videoPlayerTypes";

export function GooseVideoPlayer({
  src,
  className,
  onEnterBelow,
}: GooseVideoPlayerProps) {
  const playback = useVideoPlayback(src);
  const {
    rootRef,
    videoRef,
    playing,
    setPlaying,
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
  } = playback;
  return (
    <div
      ref={rootRef}
      className={cn("goose-video-player", className)}
      data-playing={playing ? "true" : "false"}
      data-controls={controlsVisible ? "visible" : "hidden"}
      data-ready={ready ? "true" : "false"}
      data-error={loadError ? "true" : "false"}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (playing) setControlsVisible(false);
      }}
      onFocus={revealControls}
      tabIndex={0}
      role="group"
      aria-label="视频播放器"
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "k" || e.key === "K") {
          e.preventDefault();
          e.stopPropagation();
          void togglePlay();
          return;
        }
        if (e.key === "m" || e.key === "M") {
          e.preventDefault();
          e.stopPropagation();
          toggleMute();
          return;
        }
        if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          e.stopPropagation();
          void toggleFullscreen();
          return;
        }
        if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          onEnterBelow?.();
          return;
        }
        if (e.key === "Escape" && isFullscreen) {
          e.preventDefault();
          e.stopPropagation();
          void document.exitFullscreen().catch(() => {});
        }
      }}
    >
      <video
        ref={videoRef}
        src={src}
        className="goose-video-player__video"
        playsInline
        preload="metadata"
        onError={() => {
          setLoadError(true);
          setReady(false);
          setPlaying(false);
        }}
        // 不使用原生 controls；避免抢焦点与丑陋默认条
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          void togglePlay();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          void toggleFullscreen();
        }}
      />

      {loadError && (
        <div className="goose-video-player__error" role="status">
          <VideoOff aria-hidden="true" />
          <span>视频无法读取，请从上方工具栏更换</span>
        </div>
      )}

      {/* 中央大播放钮：暂停态常显，播放态随控件淡出 */}
      {!loadError && (
        <button
          type="button"
          className="goose-video-player__center-play"
          aria-label={playing ? "暂停" : "播放"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            void togglePlay();
          }}
        >
          {playing ? (
            <Pause
              className="goose-video-player__center-icon"
              strokeWidth={1.75}
            />
          ) : (
            <Play
              className="goose-video-player__center-icon goose-video-player__center-icon--play"
              strokeWidth={1.75}
            />
          )}
        </button>
      )}

      <VideoControls playback={playback} />
    </div>
  );
}
