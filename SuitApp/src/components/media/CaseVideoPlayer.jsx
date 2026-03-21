const DEFAULT_PLAYER_TITLE = 'Video del caso';

function resolveSourceUrl(source) {
  if (typeof source === 'string') {
    return source;
  }

  if (source && typeof source === 'object' && 'src' in source) {
    return typeof source.src === 'string' ? source.src : '';
  }

  return '';
}

function shouldUseCrossOrigin(sourceUrl) {
  return /^https?:\/\//i.test(sourceUrl);
}

/**
 * Reproductor liviano para el preview de videos del caso.
 * Usamos HTML5 nativo porque el flujo sólo necesita controles básicos
 * sobre `blob:` locales y evita depender de wrappers externos.
 */
export default function CaseVideoPlayer({
  src,
  title = DEFAULT_PLAYER_TITLE,
  poster = null,
  thumbnails = null,
  className = '',
  playsInline = true,
  crossOrigin = 'anonymous',
  ...playerProps
}) {
  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-6 text-center text-sm text-slate-500">
        No hay un video disponible para este caso.
      </div>
    );
  }

  const sourceUrl = resolveSourceUrl(src);
  const playerClassName = [
    'aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 shadow-[0_24px_60px_rgba(15,23,42,0.35)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const playerCrossOrigin = shouldUseCrossOrigin(sourceUrl) ? crossOrigin : undefined;

  void thumbnails;

  return (
    <div className={playerClassName}>
      <video
        className="h-full w-full"
        controls
        playsInline={playsInline}
        preload="metadata"
        src={sourceUrl || undefined}
        poster={poster ?? undefined}
        crossOrigin={playerCrossOrigin}
        title={title}
        aria-label={title}
        {...playerProps}
      >
        Tu navegador no puede reproducir este video.
      </video>
    </div>
  );
}
