import { useEffect, useRef, useState, type CSSProperties } from "react";
import { applyPageCustomization, postPageCustomization, type LandingPageCustomization } from "./pageTypography";

export type LandingPageFrameProps = {
  backgroundCanvasSelector?: string;
  backgroundVisualSelector?: string;
  className?: string;
  sourceUrl: string;
  srcDoc?: string;
  style?: CSSProperties;
  title: string;
  customization?: LandingPageCustomization;
  applyScene?: (frame: HTMLIFrameElement) => void;
};

export type LandingPageProps = Omit<
  LandingPageFrameProps,
  "sourceUrl" | "title" | "customization" | "backgroundCanvasSelector" | "backgroundVisualSelector"
>;

const URL_FRAME_SANDBOX = "allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts";

export function LandingPageFrame({
  applyScene,
  backgroundCanvasSelector,
  backgroundVisualSelector,
  className = "",
  customization,
  sourceUrl,
  srcDoc,
  style,
  title,
}: LandingPageFrameProps) {
  const [ready, setReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    applyPageCustomization(frameRef.current, customization);
    postPageCustomization(frameRef.current, customization);
    if (frameRef.current) applyScene?.(frameRef.current);
  }, [applyScene, backgroundCanvasSelector, backgroundVisualSelector, customization]);

  return (
    <div
      className={`threeui-background landing-page-frame${className ? ` ${className}` : ""}`}
      data-state={ready ? "ready" : "loading"}
      style={{ position: "relative", overflow: "hidden", background: "transparent", pointerEvents: "auto", ...style }}
    >
      <iframe
        ref={frameRef}
        title={title}
        {...(srcDoc ? { srcDoc } : { src: sourceUrl })}
        sandbox={URL_FRAME_SANDBOX}
        loading="eager"
        onLoad={(event) => {
          applyPageCustomization(event.currentTarget, customization);
          postPageCustomization(event.currentTarget, customization);
          applyScene?.(event.currentTarget);
          setReady(true);
        }}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
          border: 0,
          background: "transparent",
          opacity: ready ? 1 : 0,
          pointerEvents: ready ? "auto" : "none",
        }}
      />
    </div>
  );
}
