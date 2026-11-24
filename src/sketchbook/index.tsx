import { createRoot } from 'react-dom/client';
import { MengToSketchbookLandingPage } from '../shaders/landing-pages/LandingPages';
import '../shaders/threeui.css';

const host = document.getElementById('sketchbook-root');

if (host) {
  createRoot(host).render(
    <div className="shader-frame">
      <MengToSketchbookLandingPage
        headingFont="instrument-serif"
        bodyFont="newsreader"
        headingWeight="400"
        bodyWeight="400"
        primaryColor="#2b2721"
        headingSize={30}
        bodySize={20}
        headingLetterSpacing={0.010}
      />
    </div>
  );
}
