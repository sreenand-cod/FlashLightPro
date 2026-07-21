# FlashLight Pro (Production Ready PWA)

A fully functional, installable Progressive Web App (PWA) that acts as an advanced flashlight. Utilizing modern Web APIs (MediaDevices API, WakeLock API) with pure CSS styling and zero dependencies.

## Features
*   **Media Constraints**: Real torch control via `applyConstraints()`.
*   **Modes**: Steady, Fast Blink, Slow Blink, Strobe, Beacon, SOS.
*   **Timer Utilities**: Auto turn-off timers (30s to 15m).
*   **PWA Ready**: 100% installable, passes PWABuilder checks, fully offline capable.
*   **UI/UX**: Dark/Light mode support, Glassmorphism, Responsive UI.

## Deployment
This project is composed entirely of static files. It requires **no server-side rendering or backend**. 

1. Clone or download the files.
2. Replace all placeholder Base64 text in binary files (images/sounds) with your actual assets.
3. Upload directly to **GitHub Pages, Netlify, Vercel, Cloudflare Pages**, or standard Apache/Nginx servers. 

**Note**: To access the Torch API securely, the application MUST be served over `https://` (or `localhost` for development).
