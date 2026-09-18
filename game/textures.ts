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
/**
 * Creates ultra-realistic 1024x1024 French Oak parquet hardwood floor texture
 * with rich wood grain fibers, individual plank tone variations, growth rings,
 * and beveled plank boundaries.
 */
export function createHardwoodFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep warm honey oak base
  ctx.fillStyle = '#4a2c16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const plankW = 256;
  const plankH = 64;

  // Natural French Oak palette with subtle organic warmth variations
  const plankTones = [
    { base: '#784a28', grain: '#543016', highlight: '#9c663a' },
    { base: '#6b3f20', grain: '#482711', highlight: '#8c5930' },
    { base: '#85542f', grain: '#5d371b', highlight: '#a87245' },
    { base: '#5c3519', grain: '#3d200d', highlight: '#7d4a25' },
    { base: '#704323', grain: '#4e2b13', highlight: '#925f34' },
    { base: '#643a1d', grain: '#42240f', highlight: '#84532c' },
  ];

  for (let y = 0; y < canvas.height; y += plankH) {
    const row = Math.floor(y / plankH);
    const offsetX = (row % 2) * (plankW / 2);

    for (let x = -plankW; x < canvas.width + plankW; x += plankW) {
      const px = x + offsetX;
      const seed = Math.abs((row * 13 + Math.floor(x / plankW) * 29) % plankTones.length);
      const tone = plankTones[seed];

      // 1. Plank base fill
      ctx.fillStyle = tone.base;
      ctx.fillRect(px, y, plankW, plankH);

      // 2. Micro wood grain striations
      ctx.fillStyle = tone.grain;
      for (let gy = 4; gy < plankH - 4; gy += 3) {
        const wave = Math.sin((px + gy) * 0.05) * 3;
        ctx.globalAlpha = 0.12 + Math.sin(gy * 0.2) * 0.06;
        ctx.fillRect(px + 4, y + gy + wave, plankW - 8, 1.2);
      }
      ctx.globalAlpha = 1.0;

      // 3. Natural wood growth rings / swirls
      if (seed % 3 === 0) {
        ctx.strokeStyle = tone.grain;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.18;
        const knotX = px + 40 + (seed * 37) % (plankW - 80);
        const knotY = y + plankH / 2;
        for (let kr = 6; kr < 26; kr += 5) {
          ctx.beginPath();
          ctx.ellipse(knotX, knotY, kr * 2.2, kr, 0.05, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      }

      // 4. Subtle top edge specular highlight (chamfer bevel catch)
      ctx.fillStyle = tone.highlight;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(px + 1, y + 1, plankW - 2, 1.5);
      ctx.globalAlpha = 1.0;

      // 5. Dark perimeter bevel groove / shadow
      ctx.strokeStyle = '#1a0e07';
      ctx.lineWidth = 2.0;
      ctx.strokeRect(px + 0.5, y + 0.5, plankW - 1, plankH - 1);
    }
  }

  // 6. Natural timber fiber noise for authentic tactile depth
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    data[i] = Math.max(0, Math.min(255, data[i] + n * 0.8));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 0.6));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.4));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(6, 6);
  return texture;
}

/**
 * Creates matching bump/displacement map for the French Oak parquet floor
 * defining bevel micro-crevices and wood grain relief.
 */
export function createHardwoodBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Neutral mid-gray base height
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const plankW = 256;
  const plankH = 64;

  for (let y = 0; y < canvas.height; y += plankH) {
    const row = Math.floor(y / plankH);
    const offsetX = (row % 2) * (plankW / 2);

    for (let x = -plankW; x < canvas.width + plankW; x += plankW) {
      const px = x + offsetX;

      // Deep recessed groove (black)
      ctx.strokeStyle = '#202020';
      ctx.lineWidth = 3.0;
      ctx.strokeRect(px + 1, y + 1, plankW - 2, plankH - 2);

      // Micro bevel rim (bright ridge)
      ctx.strokeStyle = '#a8a8a8';
      ctx.lineWidth = 1.0;
      ctx.strokeRect(px + 2.5, y + 2.5, plankW - 5, plankH - 5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

/**
 * Creates panoramic photorealistic twilight cityscape backdrop (2048x1024)
 * with multi-layered skyscrapers, illuminated glass facades, glowing window clusters,
 * architectural spires, red aviation beacons, and shimmering waterfront reflections.
 */
export function createSkylineTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Photorealistic Twilight Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.85);
  skyGrad.addColorStop(0.0, '#040711'); // Deep astronomical twilight
  skyGrad.addColorStop(0.3, '#0d1326'); // Midnight indigo
  skyGrad.addColorStop(0.55, '#1e1c44'); // Twilight purple
  skyGrad.addColorStop(0.72, '#3b1d54'); // Dusk magenta-violet
  skyGrad.addColorStop(0.85, '#9a3412'); // Rich amber horizon
  skyGrad.addColorStop(0.92, '#ea580c'); // Radiant sunset glow
  skyGrad.addColorStop(1.0, '#f59e0b'); // Golden horizon line
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Stars in Upper Sky
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 180; i++) {
    const sx = (Math.sin(i * 19.3) * 0.5 + 0.5) * canvas.width;
    const sy = (Math.cos(i * 27.7) * 0.5 + 0.5) * (canvas.height * 0.45);
    const sRad = 0.5 + (Math.sin(i * 4.1) * 0.5 + 0.5) * 1.5;
    ctx.globalAlpha = 0.3 + (Math.cos(i * 9.7) * 0.5 + 0.5) * 0.7;
    ctx.beginPath();
    ctx.arc(sx, sy, sRad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // 3. Soft Atmospheric Horizon Clouds / Haze
  const drawCloud = (cx: number, cy: number, rx: number, ry: number) => {
    const g = ctx.createRadialGradient(cx, cy, ry * 0.2, cx, cy, rx);
    g.addColorStop(0.0, 'rgba(154, 52, 18, 0.35)');
    g.addColorStop(0.6, 'rgba(59, 29, 84, 0.15)');
    g.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drawCloud(400, 720, 500, 120);
  drawCloud(1200, 700, 650, 140);
  drawCloud(1800, 740, 450, 110);

  // 4. Waterfront Bay along bottom
  const waterGrad = ctx.createLinearGradient(0, canvas.height * 0.85, 0, canvas.height);
  waterGrad.addColorStop(0.0, '#0c1322');
  waterGrad.addColorStop(0.4, '#090d18');
  waterGrad.addColorStop(1.0, '#05070d');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, canvas.height * 0.85, canvas.width, canvas.height * 0.15);

  // 5. Multi-Layered Photorealistic Skyscraper Buildings
  // Background layer (distant hazy purple towers)
  const bgBuildings = [
    { x: 40, w: 90, h: 360 },
    { x: 180, w: 120, h: 420 },
    { x: 380, w: 100, h: 380 },
    { x: 550, w: 140, h: 460 },
    { x: 780, w: 110, h: 400 },
    { x: 960, w: 130, h: 480 },
    { x: 1180, w: 95, h: 390 },
    { x: 1350, w: 150, h: 450 },
    { x: 1580, w: 120, h: 410 },
    { x: 1780, w: 110, h: 440 },
    { x: 1940, w: 90, h: 370 },
  ];
  ctx.fillStyle = 'rgba(23, 22, 48, 0.75)';
  for (const b of bgBuildings) {
    const by = canvas.height * 0.85 - b.h;
    ctx.fillRect(b.x, by, b.w, b.h);
  }

  // Foreground prominent modern towers with detailed architecture
  const fgBuildings = [
    { x: 20, w: 85, h: 460, crown: 'flat', tint: '#0b101d' },
    { x: 125, w: 110, h: 560, crown: 'spire', tint: '#0e1526' },
    { x: 255, w: 95, h: 410, crown: 'stepped', tint: '#0c1220' },
    { x: 370, w: 140, h: 640, crown: 'angled', tint: '#0f172a' },
    { x: 530, w: 105, h: 480, crown: 'antenna', tint: '#0d1424' },
    { x: 655, w: 125, h: 590, crown: 'curved', tint: '#0f172a' },
    { x: 800, w: 115, h: 450, crown: 'flat', tint: '#0c1220' },
    { x: 935, w: 160, h: 720, crown: 'spire', tint: '#111827' }, // Iconic landmark tower
    { x: 1115, w: 110, h: 520, crown: 'angled', tint: '#0e1526' },
    { x: 1245, w: 130, h: 610, crown: 'stepped', tint: '#0f172a' },
    { x: 1395, w: 95, h: 440, crown: 'flat', tint: '#0c1220' },
    { x: 1510, w: 150, h: 660, crown: 'antenna', tint: '#111827' },
    { x: 1680, w: 120, h: 540, crown: 'spire', tint: '#0e1526' },
    { x: 1820, w: 115, h: 470, crown: 'angled', tint: '#0d1424' },
    { x: 1955, w: 85, h: 420, crown: 'flat', tint: '#0b101d' },
  ];

  for (const b of fgBuildings) {
    const by = canvas.height * 0.85 - b.h;

    // Building mass
    ctx.fillStyle = b.tint;
    ctx.fillRect(b.x, by, b.w, b.h);

    // Architectural crowns
    if (b.crown === 'spire') {
      ctx.fillStyle = b.tint;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.5, by - 70);
      ctx.lineTo(b.x + b.w * 0.2, by);
      ctx.lineTo(b.x + b.w * 0.8, by);
      ctx.fill();

      // Slender metal spire needle
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.5, by - 70);
      ctx.lineTo(b.x + b.w * 0.5, by - 120);
      ctx.stroke();

      // Red flashing beacon
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.5, by - 120, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (b.crown === 'angled') {
      ctx.fillStyle = b.tint;
      ctx.beginPath();
      ctx.moveTo(b.x, by + 40);
      ctx.lineTo(b.x + b.w, by);
      ctx.lineTo(b.x + b.w, by + 40);
      ctx.fill();

      // Glowing angled crown LED trim
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(b.x, by + 40);
      ctx.lineTo(b.x + b.w, by);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (b.crown === 'stepped') {
      ctx.fillStyle = b.tint;
      ctx.fillRect(b.x + 15, by - 30, b.w - 30, 30);
      ctx.fillRect(b.x + 30, by - 55, b.w - 60, 25);
    } else if (b.crown === 'antenna') {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.5, by);
      ctx.lineTo(b.x + b.w * 0.5, by - 65);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.5, by - 65, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Glowing Office & Residential Window Clusters
    const winW = 4;
    const winH = 6;
    const gapX = 9;
    const gapY = 12;

    for (let wy = by + 20; wy < canvas.height * 0.85 - 20; wy += gapY) {
      for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += gapX) {
        const seed = (wx * 37 + wy * 61) % 100;
        if (seed < 62) {
          if (seed < 38) {
            ctx.fillStyle = 'rgba(254, 240, 138, 0.85)'; // Warm incandescent gold
          } else if (seed < 55) {
            ctx.fillStyle = 'rgba(186, 230, 253, 0.90)'; // Crisp cyan-white LED
          } else {
            ctx.fillStyle = 'rgba(251, 146, 60, 0.80)'; // Amber residential
          }
          ctx.fillRect(wx, wy, winW, winH);
        }
      }
    }

    // Shimmering water reflection beneath each building
    const reflW = b.w * 0.7;
    const reflX = b.x + b.w * 0.15;
    const reflGrad = ctx.createLinearGradient(0, canvas.height * 0.85, 0, canvas.height);
    reflGrad.addColorStop(0.0, 'rgba(254, 240, 138, 0.22)');
    reflGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.12)');
    reflGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = reflGrad;
    for (let ry = canvas.height * 0.85 + 4; ry < canvas.height; ry += 6) {
      const rw = reflW * (1 - (ry - canvas.height * 0.85) / (canvas.height * 0.15));
      ctx.fillRect(reflX + (reflW - rw) * 0.5, ry, rw, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
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

/**
 * Creates high-energy, vibrant urban graffiti and neon street-art mural:
 * "BUILT WITH GEMINI 3.8 FLASH"
 * Features 3D graffiti typography, neon glows, spray paint splatters,
 * drips, the Gemini sparkle star, and an illuminated loft brick backdrop.
 */
export function createGeminiGraffitiTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Urban Loft Exposed Brickwork & Masonry
  // Deep charcoal/slate mortar base
  ctx.fillStyle = '#0f131c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const brickH = 40;
  const brickW = 100;
  const mortar = 5;

  // Authentic architectural slate & burnt clay tones
  const brickShades = [
    { base: '#252c3b', top: '#2e3748', shadow: '#1b202c' },
    { base: '#212735', top: '#293142', shadow: '#171c26' },
    { base: '#2b3447', top: '#343f55', shadow: '#202634' },
    { base: '#1d222e', top: '#242a39', shadow: '#141820' },
    { base: '#283042', top: '#313b50', shadow: '#1e2431' },
    { base: '#1a1f2b', top: '#212736', shadow: '#12161f' },
  ];

  for (let y = 0; y < canvas.height; y += brickH + mortar) {
    const row = Math.floor(y / (brickH + mortar));
    const offsetX = (row % 2) * ((brickW + mortar) / 2);

    for (let x = -brickW; x < canvas.width + brickW; x += brickW + mortar) {
      const bx = x + offsetX;
      const seed = Math.abs((row * 17 + Math.floor(x / brickW) * 31) % brickShades.length);
      const shade = brickShades[seed];

      // Brick body
      ctx.fillStyle = shade.base;
      ctx.fillRect(bx, y, brickW, brickH);

      // Top edge highlight (ambient light catch)
      ctx.fillStyle = shade.top;
      ctx.fillRect(bx, y, brickW, 2.5);

      // Bottom edge micro-shadow into mortar recess
      ctx.fillStyle = shade.shadow;
      ctx.fillRect(bx, y + brickH - 2.5, brickW, 2.5);

      // Fine masonry texture noise on individual brick face
      if (seed % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.fillRect(bx + 8, y + 6, brickW - 16, 2);
        ctx.fillRect(bx + 14, y + 18, brickW - 28, 1.5);
      }
    }
  }

  // 2. Ambient Chromatic Spray Fog & Neon Back-blooms
  const drawSprayBloom = (cx: number, cy: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, r);
    g.addColorStop(0.0, color);
    g.addColorStop(0.5, color.replace(/[\d.]+\)$/, '0.15)'));
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // Intense neon aura blooms behind the graffiti
  drawSprayBloom(400, 600, 480, 'rgba(6, 182, 212, 0.55)');   // Cyan aura
  drawSprayBloom(1024, 620, 560, 'rgba(168, 85, 247, 0.50)'); // Violet aura
  drawSprayBloom(1640, 600, 480, 'rgba(244, 63, 94, 0.55)');  // Rose/Magenta aura
  drawSprayBloom(1024, 460, 380, 'rgba(251, 191, 36, 0.45)'); // Amber/Gold aura

  // 3. Spray Paint Splatters & Grunge Drips across the entire wall
  const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  let seed = 42;
  const colors = ['#06b6d4', '#ec4899', '#a855f7', '#fbbf24', '#ffffff', '#10b981'];
  for (let i = 0; i < 350; i++) {
    const px = pseudoRandom(seed++) * canvas.width;
    const py = 150 + pseudoRandom(seed++) * (canvas.height - 250);
    const pr = 1.5 + pseudoRandom(seed++) * 8;
    const col = colors[Math.floor(pseudoRandom(seed++) * colors.length)];
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.45 + pseudoRandom(seed++) * 0.45;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    // Occasional drip
    if (pseudoRandom(seed++) > 0.85) {
      const dripLen = 25 + pseudoRandom(seed++) * 70;
      ctx.beginPath();
      ctx.moveTo(px - pr * 0.5, py);
      ctx.lineTo(px, py + dripLen);
      ctx.lineTo(px + pr * 0.5, py);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py + dripLen, pr * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;

  // 4. Left-Wing Graffiti Feature: Stylized Neon 8-Ball Street Art (X = 360, Y = 620)
  ctx.save();
  // Outer glowing aura
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 35;
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.arc(360, 620, 110, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 10;
  ctx.stroke();

  // White center circle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(360, 620, 52, 0, Math.PI * 2);
  ctx.fill();

  // '8' numeral in graffiti font
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 68px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('8', 360, 622);

  // Crown stencil atop 8-ball
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.moveTo(310, 515);
  ctx.lineTo(330, 480);
  ctx.lineTo(360, 505);
  ctx.lineTo(390, 480);
  ctx.lineTo(410, 515);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 5. Right-Wing Graffiti Feature: Stylized Break Burst & Speed Arrows (X = 1680, Y = 620)
  ctx.save();
  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 35;
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.arc(1680, 620, 110, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 10;
  ctx.stroke();

  // Multi-color graffiti cue ball impact burst
  const burstColors = ['#fbbf24', '#f43f5e', '#a855f7', '#38bdf8'];
  for (let b = 0; b < 8; b++) {
    const bAngle = (b / 8) * Math.PI * 2;
    const bx1 = 1680 + Math.cos(bAngle) * 50;
    const by1 = 620 + Math.sin(bAngle) * 50;
    const bx2 = 1680 + Math.cos(bAngle) * 95;
    const by2 = 620 + Math.sin(bAngle) * 95;
    ctx.strokeStyle = burstColors[b % burstColors.length];
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(bx1, by1);
    ctx.lineTo(bx2, by2);
    ctx.stroke();
  }
  ctx.restore();

  // 6. Gemini 4-Pointed Sparkle Star (Graffiti Chrome Emblem)
  const drawGraffitiStar = (cx: number, cy: number, outerR: number, innerR: number, angle: number = 0) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 35;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';

    const pathStar = () => {
      ctx.beginPath();
      ctx.moveTo(0, -outerR);
      ctx.quadraticCurveTo(innerR, -innerR, outerR, 0);
      ctx.quadraticCurveTo(innerR, innerR, 0, outerR);
      ctx.quadraticCurveTo(-innerR, innerR, -outerR, 0);
      ctx.quadraticCurveTo(-innerR, -innerR, 0, -outerR);
      ctx.closePath();
    };

    pathStar();
    ctx.stroke();

    const grad = ctx.createLinearGradient(-outerR, -outerR, outerR, outerR);
    grad.addColorStop(0.0, '#38bdf8');
    grad.addColorStop(0.35, '#818cf8');
    grad.addColorStop(0.7, '#ec4899');
    grad.addColorStop(1.0, '#fbbf24');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 18;
    const innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, innerR * 2.0);
    innerGrad.addColorStop(0.0, '#ffffff');
    innerGrad.addColorStop(0.6, 'rgba(255,255,255,0.85)');
    innerGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.arc(0, 0, innerR * 2.0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Two flanking stars framing the central title
  drawGraffitiStar(570, 590, 85, 18, -Math.PI / 14);
  drawGraffitiStar(1478, 590, 85, 18, Math.PI / 14);
  drawGraffitiStar(1024, 380, 55, 12, 0);

  // 7. "BUILT WITH" Graffiti Stencil Header (Calibrated at Y = 460)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const pillW = 680;
  const pillH = 68;
  const pillX = 1024 - pillW / 2;
  const pillY = 430;

  ctx.shadowColor = 'rgba(6, 182, 212, 0.85)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 20);
  ctx.fill();

  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#38bdf8';
  ctx.font = '900 38px "Arial Black", Impact, sans-serif';
  ctx.letterSpacing = '14px';
  ctx.fillText('⚡ BUILT WITH ⚡', 1024, pillY + pillH / 2 + 2);
  ctx.restore();

  // 8. Giant "GEMINI 3.8 FLASH" Graffiti Centerpiece (Calibrated at Y = 565 and Y = 690)
  const renderGraffitiBlock = (
    text: string,
    centerY: number,
    fontSize: number,
    letterSpacing: string,
    gradColors: string[]
  ) => {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px "Arial Black", Impact, sans-serif`;
    ctx.letterSpacing = letterSpacing;

    // A. 3D Extruded Drop Shadow
    ctx.fillStyle = '#080c14';
    for (let depth = 28; depth >= 1; depth -= 2) {
      ctx.fillText(text, 1024 + depth * 0.75, centerY + depth);
    }

    // B. Outer Neon Glow Stroke
    ctx.shadowColor = gradColors[0];
    ctx.shadowBlur = 40;
    ctx.strokeStyle = gradColors[0];
    ctx.lineWidth = 22;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    ctx.strokeText(text, 1024, centerY);

    // C. Crisp Dark Outer Border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0a0f1d';
    ctx.lineWidth = 14;
    ctx.strokeText(text, 1024, centerY);

    // D. Multi-stop Graffiti Gradient Fill
    const fillGrad = ctx.createLinearGradient(300, centerY - fontSize * 0.5, 1724, centerY + fontSize * 0.5);
    gradColors.forEach((col, idx) => {
      fillGrad.addColorStop(idx / (gradColors.length - 1), col);
    });
    ctx.fillStyle = fillGrad;
    ctx.fillText(text, 1024, centerY);

    // E. Upper Glossy Specular Highlights
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 3.5;
    ctx.strokeText(text, 1024 - 2, centerY - 3);

    // F. Inner Pure Neon Core Glow
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${fontSize * 0.94}px "Arial Black", Impact, sans-serif`;
    ctx.fillText(text, 1024, centerY);

    ctx.restore();
  };

  // Line 1: "GEMINI" at Y = 560
  renderGraffitiBlock(
    'GEMINI',
    560,
    148,
    '16px',
    ['#38bdf8', '#06b6d4', '#818cf8', '#c084fc', '#ec4899', '#f43f5e']
  );

  // Line 2: "3.8 FLASH" at Y = 685
  renderGraffitiBlock(
    '3.8 FLASH',
    685,
    136,
    '12px',
    ['#f43f5e', '#ec4899', '#a855f7', '#818cf8', '#38bdf8', '#fbbf24']
  );

  // 9. Dynamic Graffiti Arrows & Underline Swashes (Calibrated at Y = 760)
  ctx.save();
  const arrowGrad = ctx.createLinearGradient(400, 760, 1648, 760);
  arrowGrad.addColorStop(0.0, 'rgba(6, 182, 212, 0)');
  arrowGrad.addColorStop(0.2, '#06b6d4');
  arrowGrad.addColorStop(0.5, '#fbbf24');
  arrowGrad.addColorStop(0.8, '#ec4899');
  arrowGrad.addColorStop(1.0, 'rgba(236, 72, 153, 0)');

  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 24;
  ctx.fillStyle = arrowGrad;
  ctx.beginPath();
  ctx.moveTo(380, 760);
  ctx.lineTo(1668, 760);
  ctx.lineTo(1648, 772);
  ctx.lineTo(400, 772);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(420, 784);
  ctx.lineTo(780, 784);
  ctx.lineTo(820, 794);
  ctx.lineTo(1220, 794);
  ctx.lineTo(1260, 784);
  ctx.lineTo(1620, 784);
  ctx.stroke();
  ctx.restore();

  // 10. Urban Street Tags & Technical Subtitle Footer (Calibrated at Y = 818)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 20px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.letterSpacing = '5px';
  ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
  ctx.shadowBlur = 12;
  ctx.fillText('★ ADVANCED AGENTIC AI • WPA REGULATION 3D BILLIARDS ★', 1024, 820);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}


