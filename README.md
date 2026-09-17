# 3D Pool Arena — Production-Quality 3D 8-Ball Pool Game

A complete, production-ready 3D 8-Ball pool game built with **Next.js (App Router)**, **TypeScript**, **Three.js**, **Tailwind CSS**, and **Firebase**.

## Features

- **Accurate Billiards Physics Engine**:
  - Deterministic 120Hz fixed-timestep integration.
  - Realistic sliding, rolling, topspin, backspin, left/right English, and stun shots.
  - Regulation 9-foot table geometry ($2.54\text{m} \times 1.27\text{m}$) with corner & side pocket funnels and cushion rail normal collision restitution.
  - Dynamic trajectory raycasting and ghost ball positioning.
- **WPA Official 8-Ball Rules Engine**:
  - Regulation break shot validation.
  - Open table mechanics until legal post-break group assignment.
  - Full foul tracking (scratches, wrong ball first contact, failure to hit rail/pocket).
  - Ball-in-hand placement and win/loss arbitration on the 8-ball.
- **Single-Player AI Bots**:
  - 4 distinct difficulty tiers: **Easy**, **Medium**, **Hard**, and **Expert**.
  - Geometric cut angle evaluations, pocket line-of-sight obstruction detection, spin planning, and difficulty-tiered aim jitter.
- **Firebase Anonymous Authentication & Unique Handles**:
  - Seamless instant guest onboarding with Anonymous Auth.
  - Unique username reservations backed by Firestore atomic transactions.
- **Real-Time Online Multiplayer**:
  - 6-character room codes for private matches and instant peer lobby joining.
  - Live Firestore snapshot synchronization with local deterministic physics replay.
  - Offline fallback support for zero-config testing.
- **Competitive Elo Rating & Global Leaderboard**:
  - Dynamic Elo score recalculations after every match.
  - Rank tier leagues from **Bronze** to **Master**.
  - Persistent match history and win rate tracking.
- **Web Audio Sound Effects**:
  - Real-time procedural audio synthesis via Web Audio API (cue strike, phenolic ball-to-ball clacks, cushion thuds, pocket drops) with zero external audio assets required.
- **High-Fidelity 3D Graphics**:
  - Procedural PBR canvas textures for all 16 pool balls (solids, stripes, 8-ball badge, Aramith red-dot cue ball).
  - Woven green wool felt table cloth, polished mahogany rails, mother-of-pearl sights, chrome corner castings, and warm drop lamp lighting.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Configure Firebase (Optional)
To enable cloud Firestore database synchronization for multiplayer and persistent online leaderboards across multiple devices, create a `.env.local` file:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```
*(Note: If omitted, the game automatically operates in local fallback mode with full functionality)*.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated Test Suite
```bash
npm test
```
All 19 automated tests covering physics integration, WPA 8-ball rules, AI bot shot selection, Elo calculations, and username validation will execute via Vitest.

### 5. Production Build
```bash
npm run build
npm start
```
