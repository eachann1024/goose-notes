/** A small, static irregularity in the existing icon strokes; no layout changes. */
export function PencilIconDefinitions() {
  return (
    <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute h-0 w-0 overflow-hidden">
      <defs>
        <filter id="goose-pencil-stroke" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" seed="8" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="0.55" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
