import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import threeDPaperSource from "./sources/3d-paper.html?raw";
import certificateSource from "./sources/3d-paper-certificate.html?raw";
import japaneseSource from "./sources/3d-paper-japanese.html?raw";
import siteOfTheYearSource from "./sources/3d-paper-site-of-the-year.html?raw";

export type ThreeDPaperVariant = "original" | "site-of-the-year" | "japanese" | "certificate";

export type ThreeDPaperProps = {
  className?: string;
  style?: CSSProperties;
  variant?: ThreeDPaperVariant;
  /** Renders a fixed, non-interactive copy: the same sheet and the same motion,
   *  but no drag and no pointer events, so a surrounding button stays clickable. */
  passive?: boolean;
  /** Which certificate a passive copy shows. Ignored when interactive. */
  certIndex?: number;
};

const sources: Record<ThreeDPaperVariant, string> = {
  original: threeDPaperSource,
  "site-of-the-year": siteOfTheYearSource,
  japanese: japaneseSource,
  certificate: certificateSource,
};

const titles: Record<ThreeDPaperVariant, string> = {
  original: "3D Paper",
  "site-of-the-year": "3D Paper — Site of the Year",
  japanese: "3D Paper — 認定証",
  certificate: "3D Paper — Certificate",
};

// The certificate sheet paints a real scan edge to edge, so a painted frame
// around it only ever read as a black box. Its own canvas is alpha:true, so the
// host and the iframe are left unpainted and the page shows through.
const frameBackground: Partial<Record<ThreeDPaperVariant, string>> = {
  certificate: "transparent",
};

// The certificate sheet reads its options from a script appended to the end of
// the document. That is early enough: the document's own scripts are already
// parsed and run by then, but boot() is a promise continuation, so the sheet
// still sees the values before it builds anything.
//
// The index is deliberately NOT part of this. It used to be, which meant every
// change of certificate rewrote the srcDoc string and made the browser tear down
// and re-create the whole document - a 1.4 MB parse, a fresh image decode and a
// new WebGL context, twice over, on every click. It is now sent over
// postMessage instead, so the frame is built once and only its texture changes.
function documentFor(variant: ThreeDPaperVariant, passive: boolean) {
  const base = sources[variant];
  if (!passive) return base;
  return `${base}<script>window.__CERT_INIT__=${JSON.stringify({ passive: true })}</script>`;
}

export function ThreeDPaper({
  className = "",
  style,
  variant = "original",
  passive = false,
  certIndex
}: ThreeDPaperProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // The frame is addressed by message, so the index has to reach a sheet that may
  // have been created after the last render - hence the ref alongside the effect.
  const certIndexRef = useRef(certIndex);
  const [documentVisible, setDocumentVisible] = useState(() => (
    typeof document === "undefined" || !document.hidden
  ));
  const [hostVisible, setHostVisible] = useState(true);
  const [ready, setReady] = useState(false);

  const requestCert = useCallback((index: number | undefined) => {
    if (index === undefined) return;
    frameRef.current?.contentWindow?.postMessage({ type: "cert-set", index }, "*");
  }, []);

  // A passive sheet learns which certificate to show over the message channel.
  // Posting on certIndex change covers navigation; posting on load covers a
  // frame that has just been mounted or remounted, which would otherwise have
  // missed a message sent before its document was listening.
  useEffect(() => {
    certIndexRef.current = certIndex;
    if (passive) requestCert(certIndex);
  }, [passive, certIndex, requestCert]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setHostVisible(entry?.isIntersecting ?? true);
    }, { rootMargin: "80px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const update = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const mounted = hostVisible && documentVisible;
  const background = frameBackground[variant] ?? "#08080a";
  // A passive copy sits inside a button that has to stay clickable, so the whole
  // subtree - host and frame - lets the pointer through. That is also what makes
  // it undraggable: the sheet never receives the pointer events its drag code
  // listens for, so there is nothing to guard.
  const pointerEvents = passive ? "none" : "auto";

  useEffect(() => {
    setReady(false);
  }, [mounted, variant]);

  return (
    <div
      ref={hostRef}
      className={`threeui-background three-d-paper${className ? ` ${className}` : ""}`}
      role="group"
      aria-label="Interactive translucent 3D paper certificate"
      data-state={!mounted ? "paused" : ready ? "ready" : "loading"}
      style={{
        position: "relative",
        overflow: "hidden",
        background,
        pointerEvents,
        ...style,
      }}
    >
      {mounted ? (
        <iframe
          ref={frameRef}
          title={titles[variant]}
          srcDoc={documentFor(variant, passive)}
          sandbox="allow-scripts"
          loading="eager"
          onLoad={() => {
            setReady(true);
            requestCert(certIndexRef.current);
          }}
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            width: "100%",
            height: "100%",
            border: 0,
            background,
            opacity: ready ? 1 : 0,
            pointerEvents,
            transition: "opacity 240ms ease-out",
          }}
        />
      ) : null}
    </div>
  );
}
