import { createRoot } from 'react-dom/client';
import { CertificatesIsland } from './CertificatesIsland';

const host = document.getElementById('certificates-root');

if (host) {
  createRoot(host).render(<CertificatesIsland />);
}
