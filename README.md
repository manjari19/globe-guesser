# 🌍 Globe Guesser

A cosmic-themed geography guessing game. The globe spins, slows down, and lands on a random country — your brother has to name it!

## Features
- 🌐 3D animated globe that spins and zooms to a destination
- 🎤 Voice input (speak your answer)
- ⌨️ Type your answer
- 💡 Hint system (first letter + character count)
- 🔥 Streak tracking
- 🌑 Dark cosmic UI
- 195 countries included

---

## Setup Instructions

### Prerequisites
- **Node.js** (v18 or higher recommended) — download from [nodejs.org](https://nodejs.org)
- **npm** (comes with Node.js)

### Step 1 — Install dependencies
Open a terminal in the `globe-guesser` folder and run:

```bash
npm install
```

This will install React, Vite, globe.gl, and Three.js. It may take 30–60 seconds.

### Step 2 — Start the dev server
```bash
npm run dev
```

You'll see output like:
```
  VITE v5.x.x  ready in 400ms
  ➜  Local:   http://localhost:5173/
```

### Step 3 — Open in browser
Go to **http://localhost:5173** in your browser.

> **Note on voice input**: Browsers require HTTPS or localhost for microphone access. The dev server (`localhost`) works fine. If you share it on a local network IP (e.g. 192.168.x.x), voice input won't work unless you set up HTTPS.

---

## How to Play
1. Press **"Spin the Globe"**
2. Watch the globe spin and slow down to a country
3. Type your answer or click **"🎤 Speak answer"** to say it out loud
4. Press Enter or → to submit
5. **Hint**: Click "Show hint" if stuck — reveals first letter and length
6. **Give up**: Reveals the answer without counting as a wrong
7. Hit **"Next Country →"** to play again

---

## Building for Production (optional)
To create a deployable build:
```bash
npm run build
```
Output goes to the `dist/` folder. You can host it on Netlify, Vercel, or GitHub Pages.

---

## Troubleshooting
| Problem | Fix |
|---|---|
| Globe doesn't appear | Make sure `npm install` completed successfully |
| Voice button missing | Browser doesn't support Web Speech API (try Chrome) |
| Slow first load | globe.gl loads textures from CDN — needs internet |
| Port already in use | Run `npm run dev -- --port 3000` to use a different port |
