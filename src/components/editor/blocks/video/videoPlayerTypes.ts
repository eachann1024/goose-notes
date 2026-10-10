export type GooseVideoPlayerProps = {
  src: string;
  className?: string;
  /** 在播放器获得键盘焦点时按 Enter：通知外层在块下方插空行 */
  onEnterBelow?: () => void;
};
