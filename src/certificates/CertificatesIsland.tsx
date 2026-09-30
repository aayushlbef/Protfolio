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
  // Mirrors `current` so the message listener can read the latest value without
  // being torn down and re-subscribed on every change.
  const currentRef = useRef(0);
  // The certificate the cards have asked for and the sheet has not confirmed
  // yet. While this is set, reports from the sheet are stale by definition: the
  // sheet is still turning towards an older request, so honouring them would
  // drag the cards backwards and make the next click compute from the wrong one.
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const post = useCallback((index: number) => {
    const frame = hostRef.current?.querySelector('iframe');
    if (!frame?.contentWindow) return false;
    frame.contentWindow.postMessage({ type: 'cert-show', index }, '*');
    return true;
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const next = wrap(index);
      currentRef.current = next;
      setCurrent(next);
      if (post(next)) pendingRef.current = next;
    },
    [post]
  );

  // Dragging the sheet reports which certificate came to the front, so the
  // cards follow along instead of drifting out of sync.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // The two side cards are the same sheet in a non-interactive copy, so
      // three documents share this listener. Only the centre one drives the
      // cards; a message from anywhere else is not ours to act on.
      const frame = hostRef.current?.querySelector('iframe');
      if (!frame || event.source !== frame.contentWindow) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'cert-ready') {
        setReady(true);
        // The sheet can mount (or remount when it scrolls out of view) long
        // after a card was clicked, and any request sent before its document
        // was listening is lost. It reports what it is actually showing, so
        // only re-command when the two genuinely disagree. This also avoids
        // spinning a fresh sheet that is already on the right certificate.
        const shown = wrap(Number(data.index) || 0);
        if (shown !== currentRef.current && post(currentRef.current)) {
          pendingRef.current = currentRef.current;
        }
        return;
      }

      if (data.type !== 'cert-changed') return;

      const reported = wrap(Number(data.index) || 0);
      const pending = pendingRef.current;

      if (pending === null) {
        // Nothing outstanding, so the sheet was turned by hand: follow it.
        currentRef.current = reported;
        setCurrent(reported);
      } else if (reported === pending) {
        // The sheet caught up with what the cards asked for.
        pendingRef.current = null;
        currentRef.current = reported;
        setCurrent(reported);
      } else if (data.driven) {
        // The sheet dropped the request the cards made - a drag took over
        // before the turn ran. Waiting for the old target would leave the
        // cards describing a certificate that is no longer showing.
        pendingRef.current = null;
        currentRef.current = reported;
        setCurrent(reported);
      }
      // otherwise: a stale report from an earlier request - ignore it
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
        <Suspense fallback={<img src={thumbUrl(CERTS[prev].thumb)} alt="" loading="lazy" />}>
          <ThreeDPaper variant="certificate" passive certIndex={prev} />
        </Suspense>
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
        <Suspense fallback={<img src={thumbUrl(CERTS[next].thumb)} alt="" loading="lazy" />}>
          <ThreeDPaper variant="certificate" passive certIndex={next} />
        </Suspense>
      </button>

      <div className="cert-status" role="status" aria-live="polite">
        <span className="cert-status-count">
          {String(current + 1).padStart(2, '0')} / {String(COUNT).padStart(2, '0')}
        </span>
        <span className="cert-status-text">
          {ready ? active.title : 'Loading certificates…'}
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
