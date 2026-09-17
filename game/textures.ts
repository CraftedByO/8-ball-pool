import * as THREE from 'three';

// Authentic Aramith Tournament Super Pro Ball Colors
export const BALL_COLORS: { [id: number]: string } = {
  0: '#fcfcfb', // Pure Polished Ivory (Cue Ball)
  1: '#f59e0b', // 1: Tournament Amber Gold (Solid)
  2: '#1d4ed8', // 2: Deep Cobalt Royal Blue (Solid)
  3: '#dc2626', // 3: Bright Crimson Fire Red (Solid)
  4: '#6b21a8', // 4: Royal Imperial Purple (Solid)
  5: '#ea580c', // 5: Vibrant Tangerine Orange (Solid)
  6: '#15803d', // 6: Deep Tournament Bottle Green (Solid)
  7: '#7f1d1d', // 7: Dark Burgundy Maroon (Solid)
  8: '#0a0a0c', // 8: Deep Onyx Black (Eight Ball)
  9: '#f59e0b', // 9: Tournament Amber Gold Stripe
  10: '#1d4ed8', // 10: Deep Cobalt Royal Blue Stripe
  11: '#dc2626', // 11: Bright Crimson Fire Red Stripe
  12: '#6b21a8', // 12: Royal Imperial Purple Stripe
  13: '#ea580c', // 13: Vibrant Tangerine Orange Stripe
  14: '#15803d', // 14: Deep Tournament Bottle Green Stripe
  15: '#7f1d1d', // 15: Dark Burgundy Maroon Stripe
};

/**
 * Creates ultra-high-resolution (1024x512) procedural canvas textures for all 16 pool balls
 * featuring authentic Aramith Super Pro typography and 6-dot measle cue ball.
 */
export function createBallTexture(ballId: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const color = BALL_COLORS[ballId] || '#ffffff';
  const isCue = ballId === 0;
  const isStripe = ballId >= 9;

  if (isCue) {
    // Pure polished ivory base
    ctx.fillStyle = '#fafaf9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Authentic Aramith Pro Cup 6-Dot "Measle" layout
    // 6 symmetrically placed circular red dots on the sphere
    ctx.fillStyle = '#dc2626';
    const dotRadius = 18;

    // Equator dots (4 points around equator)
    const equatorY = canvas.height * 0.5;
    for (const u of [0.0, 0.25, 0.5, 0.75, 1.0]) {
      ctx.beginPath();
      ctx.arc(canvas.width * u, equatorY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top and Bottom Pole dots
    for (const u of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.arc(canvas.width * u, canvas.height * 0.16, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(canvas.width * u, canvas.height * 0.84, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (isStripe) {
    // Clean ivory white base
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Wide saturated colored central stripe band
    ctx.fillStyle = color;
    const stripeHeight = canvas.height * 0.52;
    const stripeY = (canvas.height - stripeHeight) / 2;
    ctx.fillRect(0, stripeY, canvas.width, stripeHeight);

    // Thin crisp contrast pin-stripe borders at edges of stripe
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, stripeY, canvas.width, 2);
    ctx.fillRect(0, stripeY + stripeHeight - 2, canvas.width, 2);

    // Number badges on front and back
    drawNumberCircle(ctx, 256, 256, ballId);
    drawNumberCircle(ctx, 768, 256, ballId);
  } else {
    // Solid tournament color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Number badges on front and back
    drawNumberCircle(ctx, 256, 256, ballId);
    drawNumberCircle(ctx, 768, 256, ballId);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function drawNumberCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, num: number) {
  const radius = 86;

  // Outer subtle dark contour for badge definition
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.arc(cx, cy + 1, radius + 2, 0, Math.PI * 2);
  ctx.fill();

  // Crisp pure white circular badge
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Fine inner accent ring
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Number typography: Ultra-crisp bold modern glyphs
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 88px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num.toString(), cx, cy + 4);

  // Underline for 6 and 9
  if (num === 6 || num === 9) {
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(cx - 32, cy + 50);
    ctx.lineTo(cx + 32, cy + 50);
    ctx.stroke();
  }
}

/**
 * Creates authentic Simonis 860 Tournament Blue-Green worsted cloth texture
 * with microscopic woven twill pattern
 */
export function createFeltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep Simonis 860 Tournament Green base
  ctx.fillStyle = '#0a5438';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Worsted wool micro twill weave pattern
  ctx.fillStyle = '#0d6141';
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      if ((x + y) % 8 === 0) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  // Micro-fiber noise for authentic cloth depth
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    data[i] = Math.max(0, Math.min(255, data[i] + n * 0.7));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.8));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(4, 2);
  return texture;
}

/**
 * Creates luxury Brazilian Mahogany / Dark Burl Walnut wood grain texture
 * with deep grain striations, chatoyancy, and satin lacquer warmth.
 */
export function createMahoganyWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep rich mahogany / walnut gradient base
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0.0, '#2e1205');
  grad.addColorStop(0.5, '#3b1807');
  grad.addColorStop(1.0, '#240d03');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Layered wavy longitudinal grain lines
  for (let y = 0; y < canvas.height; y += 3) {
    const wave = Math.sin(y * 0.04) * 8 + Math.cos(y * 0.015) * 12;
    const alpha = 0.04 + Math.sin(y * 0.1) * 0.03;
    ctx.strokeStyle = y % 6 === 0 ? `rgba(251, 191, 36, ${alpha})` : `rgba(15, 6, 2, ${alpha * 1.8})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      canvas.width * 0.3,
      y + wave,
      canvas.width * 0.7,
      y - wave,
      canvas.width,
      y
    );
    ctx.stroke();
  }

  // Burl knot organic rings
  const knots = [
    { x: 260, y: 180, r: 60 },
    { x: 780, y: 340, r: 80 },
  ];
  for (const k of knots) {
    for (let r = 8; r < k.r; r += 7) {
      ctx.strokeStyle = 'rgba(20, 8, 3, 0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(k.x, k.y, r * 1.8, r, Math.PI / 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates high-dynamic-range procedural equirectangular environment map
 * simulating luxury penthouse lounge with overhead billiard lighting canopy,
 * city skyline panorama, and warm architectural lighting.
 */
export function createEnvironmentTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Atmosphere gradient: ceiling twilight into warm horizon dusk
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0.0, '#090d16'); // Deep zenith
  skyGrad.addColorStop(0.3, '#131b2e'); // Upper ceiling
  skyGrad.addColorStop(0.5, '#1e293b'); // Horizon twilight
  skyGrad.addColorStop(0.52, '#9a3412'); // Amber dusk horizon
  skyGrad.addColorStop(0.56, '#451a03'); // Warm timber wall bounce
  skyGrad.addColorStop(1.0, '#1c0d04'); // Dark floor bounce
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Ceiling Zenith: Radiant Warm Billiard Canopy Lamps
  // These soft rectangular radiant blooms project sharp, realistic specular highlights
  // on every phenolic ball and polished wood rail as they move across the table.
  const drawCanopyLight = (cx: number, cy: number, w: number, h: number) => {
    const radial = ctx.createRadialGradient(cx, cy, 5, cx, cy, Math.max(w, h));
    radial.addColorStop(0.0, '#ffffff');
    radial.addColorStop(0.2, '#fffbeb');
    radial.addColorStop(0.5, 'rgba(254, 240, 138, 0.65)');
    radial.addColorStop(0.8, 'rgba(217, 119, 6, 0.25)');
    radial.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
  };

  // Twin overhead lamp blooms centered above the table at the ceiling
  drawCanopyLight(canvas.width * 0.42, 60, 110, 40);
  drawCanopyLight(canvas.width * 0.58, 60, 110, 40);

  // 3. Perimeter warm architectural wall sconce highlights
  drawCanopyLight(canvas.width * 0.12, canvas.height * 0.45, 60, 30);
  drawCanopyLight(canvas.width * 0.88, canvas.height * 0.45, 60, 30);

  // 4. Skyline horizon glow with window reflections
  ctx.fillStyle = 'rgba(253, 224, 71, 0.4)';
  for (let x = 40; x < canvas.width; x += 18) {
    if ((x * 13) % 100 < 60) {
      ctx.fillRect(x, canvas.height * 0.49, 8, 4);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates warm golden-oak parquet hardwood floor texture
 */
export function createHardwoodFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm caramel oak base
  ctx.fillStyle = '#6d4527';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const plankW = 128;
  const plankH = 32;

  // Draw wood planks with staggered layout and subtle grain variation
  const colors = ['#7c4f2e', '#6e4425', '#875834', '#603c20', '#744a2c'];

  for (let y = 0; y < canvas.height; y += plankH) {
    const row = Math.floor(y / plankH);
    const offsetX = (row % 2) * (plankW / 2);
    for (let x = -plankW; x < canvas.width + plankW; x += plankW) {
      const colorIdx = Math.abs((row * 7 + Math.floor(x / plankW) * 13) % colors.length);
      ctx.fillStyle = colors[colorIdx];
      ctx.fillRect(x + offsetX, y, plankW, plankH);

      // Fine plank bevel / groove
      ctx.strokeStyle = 'rgba(20, 10, 5, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + offsetX, y, plankW, plankH);

      // Subtle longitudinal wood grain lines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fillRect(x + offsetX + 4, y + 8, plankW - 8, 2);
      ctx.fillRect(x + offsetX + 8, y + 20, plankW - 16, 1.5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

/**
 * Creates panoramic twilight cityscape backdrop with glowing skyscraper windows
 */
export function createSkylineTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Twilight sky gradient: deep indigo to warm sunset amber
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0.0, '#0a0f1d'); // deep midnight navy
  skyGrad.addColorStop(0.4, '#1e1b4b'); // twilight violet
  skyGrad.addColorStop(0.7, '#312e81'); // dusk royal purple
  skyGrad.addColorStop(0.88, '#9a3412'); // warm amber horizon
  skyGrad.addColorStop(1.0, '#ea580c'); // sunset orange glow
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Stars in upper sky
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    const sx = Math.random() * canvas.width;
    const sy = Math.random() * (canvas.height * 0.4);
    const sRad = Math.random() * 1.2;
    ctx.beginPath();
    ctx.arc(sx, sy, sRad, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Distant mountain/haze layer
  ctx.fillStyle = 'rgba(20, 15, 35, 0.7)';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  ctx.lineTo(0, canvas.height * 0.75);
  ctx.quadraticCurveTo(canvas.width * 0.35, canvas.height * 0.72, canvas.width * 0.7, canvas.height * 0.78);
  ctx.lineTo(canvas.width, canvas.height * 0.73);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.fill();

  // 4. Distant skyline silhouettes
  const buildings = [
    { x: 30, w: 45, h: 220 },
    { x: 85, w: 60, h: 280, antenna: true },
    { x: 155, w: 50, h: 190 },
    { x: 215, w: 75, h: 320, crown: 'spire' },
    { x: 300, w: 65, h: 240 },
    { x: 375, w: 85, h: 360, crown: 'angled' },
    { x: 470, w: 55, h: 210 },
    { x: 535, w: 70, h: 340, antenna: true },
    { x: 615, w: 80, h: 260 },
    { x: 705, w: 60, h: 380, crown: 'spire' },
    { x: 775, w: 70, h: 270 },
    { x: 855, w: 90, h: 310, crown: 'angled' },
    { x: 955, w: 60, h: 230 },
  ];

  for (const b of buildings) {
    const by = canvas.height - b.h;

    // Building silhouette
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(b.x, by, b.w, b.h);

    // Architectural crown
    if (b.crown === 'spire') {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2, by - 35);
      ctx.lineTo(b.x + b.w * 0.2, by);
      ctx.lineTo(b.x + b.w * 0.8, by);
      ctx.fill();

      // Red beacon light
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, by - 35, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.crown === 'angled') {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(b.x, by + 25);
      ctx.lineTo(b.x + b.w, by);
      ctx.lineTo(b.x + b.w, by + 25);
      ctx.fill();
    } else if (b.antenna) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2, by);
      ctx.lineTo(b.x + b.w / 2, by - 40);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, by - 40, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Windows (warm golden and cyan glowing lights)
    const winW = 3;
    const winH = 4;
    const gapX = 6;
    const gapY = 8;

    for (let wy = by + 12; wy < canvas.height - 20; wy += gapY) {
      for (let wx = b.x + 5; wx < b.x + b.w - 5; wx += gapX) {
        const rand = (wx * 17 + wy * 31) % 100;
        if (rand < 55) {
          if (rand < 42) {
            ctx.fillStyle = 'rgba(253, 224, 71, 0.85)'; // Warm yellow/gold window
          } else {
            ctx.fillStyle = 'rgba(186, 230, 253, 0.85)'; // Cool cyan/white office window
          }
          ctx.fillRect(wx, wy, winW, winH);
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates luxury geometric designer area rug texture
 */
export function createRugTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep midnight navy base
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer gold border
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  // Inner cream accent border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

  // Subtle geometric diamond pattern in center field
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.22)';
  ctx.lineWidth = 2;
  const step = 48;
  for (let x = -canvas.width; x < canvas.width * 2; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 40);
    ctx.lineTo(x + canvas.height, canvas.height - 40);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, canvas.height - 40);
    ctx.lineTo(x + canvas.height, 40);
    ctx.stroke();
  }

  // Soft fabric noise
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Creates modern abstract gold-leaf and emerald gallery artwork texture
 */
export function createGalleryArtTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  // Dark slate canvas background
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Emerald and navy paint strokes
  ctx.fillStyle = '#065f46';
  ctx.beginPath();
  ctx.ellipse(220, 160, 140, 90, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.ellipse(320, 140, 110, 70, -Math.PI / 6, 0, Math.PI * 2);
  ctx.fill();

  // Bold metallic gold leaf brush strokes
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(80, 240);
  ctx.bezierCurveTo(180, 60, 340, 260, 440, 80);
  ctx.stroke();

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(120, 220);
  ctx.bezierCurveTo(220, 80, 320, 220, 420, 110);
  ctx.stroke();

  // Gold spatter dots
  ctx.fillStyle = '#fef08a';
  for (let i = 0; i < 40; i++) {
    const ax = 100 + Math.random() * 320;
    const ay = 60 + Math.random() * 200;
    ctx.beginPath();
    ctx.arc(ax, ay, 1.5 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Creates ultra-crisp gallery branding masterpiece for the feature wall:
 * "Built with Gemini 3.8 Flash" with iconic radiant Gemini sparkle insignia,
 * cyan/purple aurora glow, and modern architectural typography.
 */
export function createGeminiBrandedArtTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep luxury obsidian & midnight-blue backdrop
  const bgGrad = ctx.createRadialGradient(512, 320, 40, 512, 320, 580);
  bgGrad.addColorStop(0.0, '#0d1527');
  bgGrad.addColorStop(0.45, '#070b14');
  bgGrad.addColorStop(1.0, '#030509');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Ambient chromatic auroral blooms
  // Cyan bloom (left-center)
  const cyanGlow = ctx.createRadialGradient(380, 200, 10, 380, 200, 260);
  cyanGlow.addColorStop(0.0, 'rgba(56, 189, 248, 0.22)');
  cyanGlow.addColorStop(0.6, 'rgba(56, 189, 248, 0.05)');
  cyanGlow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = cyanGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Violet/purple bloom (right-center)
  const violetGlow = ctx.createRadialGradient(640, 240, 10, 640, 240, 280);
  violetGlow.addColorStop(0.0, 'rgba(168, 85, 247, 0.20)');
  violetGlow.addColorStop(0.6, 'rgba(168, 85, 247, 0.04)');
  violetGlow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = violetGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3. Subtle architectural geometric micro-grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.lineWidth = 1;
  for (let x = 64; x < canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 32);
    ctx.lineTo(x, canvas.height - 32);
    ctx.stroke();
  }
  for (let y = 64; y < canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(32, y);
    ctx.lineTo(canvas.width - 32, y);
    ctx.stroke();
  }

  // 4. Inset architectural gallery border
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);

  // Corner decorative registration marks
  const corners = [
    [42, 42],
    [canvas.width - 42, 42],
    [42, canvas.height - 42],
    [canvas.width - 42, canvas.height - 42],
  ];
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  for (const [cx, cy] of corners) {
    const sx = cx < 500 ? 1 : -1;
    const sy = cy < 300 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * 14);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * 14, cy);
    ctx.stroke();
  }

  // 5. Draw Iconic Gemini 4-Pointed Sparkle Star
  const drawSparkle = (cx: number, cy: number, outerR: number, innerR: number, angle: number = 0) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const starGrad = ctx.createLinearGradient(-outerR, -outerR, outerR, outerR);
    starGrad.addColorStop(0.0, '#38bdf8'); // cyan
    starGrad.addColorStop(0.4, '#818cf8'); // indigo
    starGrad.addColorStop(0.8, '#c084fc'); // purple
    starGrad.addColorStop(1.0, '#fbbf24'); // gold tip
    ctx.fillStyle = starGrad;

    ctx.beginPath();
    // 4 points with smooth concave arcs
    ctx.moveTo(0, -outerR);
    ctx.quadraticCurveTo(innerR, -innerR, outerR, 0);
    ctx.quadraticCurveTo(innerR, innerR, 0, outerR);
    ctx.quadraticCurveTo(-innerR, innerR, -outerR, 0);
    ctx.quadraticCurveTo(-innerR, -innerR, 0, -outerR);
    ctx.closePath();
    ctx.fill();

    // Central radiant white flare
    const flare = ctx.createRadialGradient(0, 0, 0, 0, 0, innerR * 1.8);
    flare.addColorStop(0.0, '#ffffff');
    flare.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
    flare.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.arc(0, 0, innerR * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Primary Gemini Sparkle Star
  drawSparkle(512, 170, 75, 14);

  // Companion secondary star (Gemini twin-star hallmark)
  drawSparkle(615, 120, 28, 5.5, Math.PI / 12);
  drawSparkle(415, 225, 20, 4, -Math.PI / 8);

  // 6. Modern Typographic Branding
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // "BUILT WITH"
  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '10px';
  ctx.fillText('BUILT WITH', 512, 290);

  // "Gemini 3.8 Flash"
  const textGrad = ctx.createLinearGradient(200, 370, 824, 370);
  textGrad.addColorStop(0.0, '#ffffff');
  textGrad.addColorStop(0.65, '#f8fafc');
  textGrad.addColorStop(0.85, '#e0e7ff');
  textGrad.addColorStop(1.0, '#93c5fd');

  ctx.fillStyle = textGrad;
  ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '2px';
  // Subtle outer drop shadow glow
  ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
  ctx.shadowBlur = 18;
  ctx.fillText('Gemini 3.8 Flash', 512, 365);

  ctx.shadowBlur = 0; // reset shadow

  // 7. Glowing Laser Separator Bar
  const lineGrad = ctx.createLinearGradient(220, 430, 804, 430);
  lineGrad.addColorStop(0.0, 'rgba(56, 189, 248, 0)');
  lineGrad.addColorStop(0.3, '#38bdf8');
  lineGrad.addColorStop(0.5, '#ffffff');
  lineGrad.addColorStop(0.7, '#a855f7');
  lineGrad.addColorStop(1.0, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(220, 428, 584, 2.5);

  // Central glowing ruby/gold jewel node
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(512, 429, 4, 0, Math.PI * 2);
  ctx.fill();

  // 8. Engineering Subtitle & Technical Credentials
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '5px';
  ctx.fillText('INTELLIGENT 3D BILLIARDS SIMULATION', 512, 475);

  // Bottom Technical Badge
  ctx.fillStyle = '#64748b';
  ctx.font = '500 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.letterSpacing = '2.5px';
  ctx.fillText('120HZ RIGID BODY DYNAMICS • PBR RAYTRACED SHADING • WPA RULES', 512, 535);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

