import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

// Supplies the sizing rules for the component's host element. Without
// `.threeui-background { width/height: 100% }` the host div would collapse to
// zero height and the sandboxed iframe inside it would not be visible.
import '../shaders/threeui.css';

// Metadata only - the full-size scans stay in the sheet's own source and are
// never pulled into this bundle.
import certificates from './certificates.meta.json';

const ThreeDPaper = lazy(() =>
  import('../shaders/3d-paper/ThreeDPaper').then((m) => ({ default: m.ThreeDPaper }))
);

type Cert = {
  index: number;
  title: string;
  issuer: string;
  detail: string;
  href: string | null;
  thumb: string;
};

const CERTS = certificates as Cert[];
const COUNT = CERTS.length;

// Images live in public/, so they need the deploy base for sub-path hosting.
const thumbUrl = (file: string) =>
  `${import.meta.env.BASE_URL}images/certificates/${file}`;

const wrap = (i: number) => ((i % COUNT) + COUNT) % COUNT;

export function CertificatesIsland() {
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);

  // The sheet renders inside a sandboxed opaque-origin iframe, so it is
  // unreachable from here. ThreeDPaper forwards no ref, so the frame is looked
  // up by selector; the certificate document answers on postMessage.
  const hostRef = useRef<HTMLDivElement>(null);

  const post = useCallback((index: number) => {
    const frame = hostRef.current?.querySelector('iframe');
    frame?.contentWindow?.postMessage({ type: 'cert-show', index }, '*');
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const next = wrap(index);
      setCurrent(next);
      post(next);
    },
    [post]
  );

  // Dragging the sheet reports which certificate came to the front, so the
  // cards follow along instead of drifting out of sync.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'cert-ready') {
        setReady(true);
        // The sheet may mount after the current index changed, so re-assert it.
        // Skipped when it is already 0: the sheet starts on certificate one, and
        // commanding it to show certificate one makes it spin a full turn.
        setCurrent((c) => {
          if (c !== 0) post(c);
          return c;
        });
      } else if (data.type === 'cert-changed') {
        setCurrent(wrap(Number(data.index) || 0));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post]);

  const prev = wrap(current - 1);
  const next = wrap(current + 1);
  const active = CERTS[current];

  return (
    <div className="cert-stage">
      <button
        type="button"
        className="cert-side cert-side--prev"
        onClick={() => goTo(prev)}
        aria-label={`Previous certificate: ${CERTS[prev].title}, ${CERTS[prev].issuer}`}
      >
        <img src={thumbUrl(CERTS[prev].thumb)} alt="" loading="lazy" />
        <span className="cert-side-body">
          <span className="cert-side-dir">Previous</span>
          <span className="cert-side-title">{CERTS[prev].title}</span>
          <span className="cert-side-meta">{CERTS[prev].issuer}</span>
        </span>
      </button>

      <div className="cert-paper" ref={hostRef}>
        <Suspense fallback={<div className="cert-paper-fallback" aria-hidden="true" />}>
          <ThreeDPaper variant="certificate" />
        </Suspense>
      </div>

      <button
        type="button"
        className="cert-side cert-side--next"
        onClick={() => goTo(next)}
        aria-label={`Next certificate: ${CERTS[next].title}, ${CERTS[next].issuer}`}
      >
        <img src={thumbUrl(CERTS[next].thumb)} alt="" loading="lazy" />
        <span className="cert-side-body">
          <span className="cert-side-dir">Next</span>
          <span className="cert-side-title">{CERTS[next].title}</span>
          <span className="cert-side-meta">{CERTS[next].issuer}</span>
        </span>
      </button>

      <div className="cert-status" role="status" aria-live="polite">
        <span className="cert-status-count">
          {String(current + 1).padStart(2, '0')} / {String(COUNT).padStart(2, '0')}
        </span>
        <span className="cert-status-text">
          {ready ? active.issuer : 'Loading certificates…'}
          {active.href ? (
            <a
              className="cert-index-link"
              href={active.href}
              target="_blank"
              rel="noopener"
            >
              Verify
            </a>
          ) : null}
        </span>
      </div>
    </div>
  );
}
