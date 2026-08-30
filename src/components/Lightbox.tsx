// Accessible zoom lightbox (S61 Chain C, O-S61-18). Dependency-free — no Radix,
// no Headless UI, matching the repo's "utility classes only" rule.
//
// SSR/prerender contract: <LightboxImage> renders a plain <img> inside a plain
// wrapper. That is exactly what lands in dist/prerender/*.html — no dialog, no
// portal, no handlers. The zoom behaviour is a HYDRATION ENHANCEMENT: the
// overlay only ever mounts after a click in a real browser, so a JS-blind
// crawler (and a user with JS off) still sees the image and its alt text.
//
// Every consumer must pass real alt text plus explicit width/height so the
// browser reserves layout space (CLS), and loading="lazy" for below-the-fold
// images.
import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

const clamp = (v: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));

interface LightboxProps {
  src: string;
  alt: string;
  caption?: ReactNode;
  onClose: () => void;
}

/** The overlay itself. Mounted only on the client, only while open. */
const LightboxOverlay: FC<LightboxProps> = ({ src, alt, caption, onClose }) => {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The element focus returns to on close — captured before we steal focus.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    // Body scroll lock. Compensate for the scrollbar's width so the page
    // underneath doesn't visibly shift as it disappears.
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      returnFocusRef.current?.focus?.();
    };
  }, []);

  // ESC to close + a focus trap over the dialog's own tabbables.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => clamp(z + ZOOM_STEP));
        return;
      }
      if (e.key === '-') {
        e.preventDefault();
        setZoom((z) => clamp(z - ZOOM_STEP));
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button');
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      // Wrap in both directions, and pull focus back in if it has escaped.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Scroll / pinch to zoom. Registered non-passive so preventDefault holds and
  // the page behind cannot scroll-chain. On a trackpad pinch the browser sends
  // wheel events with ctrlKey set, so this covers both gestures.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clamp(z - Math.sign(e.deltaY) * 0.25));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      // Click-outside: the backdrop is this element; inner content stops
      // propagation, so only true outside clicks close.
      onClick={onClose}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <div className="absolute right-4 top-4 flex items-center gap-2" onClick={stop}>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => clamp(z - ZOOM_STEP))}
          disabled={zoom <= MIN_ZOOM}
          className="h-10 w-10 rounded-lg bg-white/10 text-xl font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => clamp(z + ZOOM_STEP))}
          disabled={zoom >= MAX_ZOOM}
          className="h-10 w-10 rounded-lg bg-white/10 text-xl font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
        >
          +
        </button>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="h-10 w-10 rounded-lg bg-white/10 text-xl font-semibold text-white transition hover:bg-white/20"
        >
          ×
        </button>
      </div>

      <div className="max-h-full max-w-full overflow-auto" onClick={stop}>
        <img
          src={src}
          alt={alt}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="max-h-[80vh] w-auto max-w-full rounded-lg transition-transform duration-150"
        />
      </div>

      {caption && (
        <p className="mt-4 text-center text-sm text-white/70" onClick={stop}>
          {caption}
        </p>
      )}
    </div>
  );
};

interface LightboxImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: ReactNode;
  className?: string;
  imgClassName?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * A plain image that becomes zoomable once JavaScript has hydrated.
 *
 * Prerendered output is just <div><img …/><figcaption?/></div>. The button
 * semantics and overlay are attached on the client only, so the static HTML
 * carries no interactive affordance it cannot honour.
 */
export const LightboxImage: FC<LightboxImageProps> = ({
  src,
  alt,
  width,
  height,
  caption,
  className = '',
  imgClassName = '',
  loading = 'lazy',
}) => {
  const [open, setOpen] = useState(false);
  // False during SSR and on the very first client render, so the server HTML
  // and the initial hydration pass match exactly (no hydration mismatch).
  const [enhanced, setEnhanced] = useState(false);
  useEffect(() => setEnhanced(true), []);

  const close = useCallback(() => setOpen(false), []);

  const img = (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      className={imgClassName}
    />
  );

  return (
    <figure className={className}>
      {enhanced ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${alt} — click to enlarge`}
          className="block w-full cursor-zoom-in"
        >
          {img}
        </button>
      ) : (
        img
      )}
      {caption && (
        <figcaption className="mt-3 text-center text-sm text-gray-500">{caption}</figcaption>
      )}
      {enhanced && open && (
        <LightboxOverlay src={src} alt={alt} caption={caption} onClose={close} />
      )}
    </figure>
  );
};
