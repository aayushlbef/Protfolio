import { lazy, Suspense } from 'react';

// Supplies the sizing rules for the component's host element. Without
// `.threeui-background { width/height: 100% }` the host div would collapse to
// zero height and the sandboxed iframe inside it would not be visible.
import '../shaders/threeui.css';

/**
 * The ThreeDPaper component inlines four ~630 KB HTML documents (each with its
 * own copy of three.js r149) through Vite's `?raw` imports, and the
 * certificate variant additionally carries the inlined certificate scans.
 * It is therefore code-split: the chunk is only fetched once this section
 * scrolls into view, keeping it out of the initial page load.
 */
const ThreeDPaper = lazy(() =>
  import('../shaders/3d-paper/ThreeDPaper').then((m) => ({ default: m.ThreeDPaper }))
);

export function CertificatesIsland() {
  return (
    <Suspense fallback={<div className="cert-paper-fallback" aria-hidden="true" />}>
      <ThreeDPaper variant="certificate" />
    </Suspense>
  );
}
