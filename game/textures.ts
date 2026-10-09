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
 * Studio-style equirectangular environment used for image-based lighting.
 * A dark hall lit by a long overhead tournament fixture: the bright rectangular softboxes
 * are what give pool balls, lacquered rails and chrome their realistic window-shaped highlights.
 */
export function createEnvironmentTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark hall: faint warm ceiling, neutral walls, near-black floor bounce
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0.0, '#1a1713');
  grad.addColorStop(0.35, '#15130f');
  grad.addColorStop(0.5, '#1b1712');
  grad.addColorStop(0.62, '#0c0b0a');
  grad.addColorStop(1.0, '#050505');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const softbox = (x: number, y: number, w: number, h: number, color: string, blur: number) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  };

  // Overhead fixture directly above the table (zenith = top rows of an equirect map)
  softbox(0, 0, canvas.width, 22, '#fff7e6', 26);

  // Two long fill softboxes either side, mid elevation: the elongated rectangles seen on every ball
  softbox(canvas.width * 0.18, 92, 170, 34, '#ffffff', 22);
  softbox(canvas.width * 0.68, 92, 170, 34, '#ffffff', 22);

  // Faint warm LED strips running around the wall bases
  ctx.fillStyle = 'rgba(255, 200, 130, 0.35)';
  ctx.fillRect(0, canvas.height * 0.55, canvas.width, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function noiseOver(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Dark warm-charcoal tournament carpet with a faint woven diamond lattice.
 * Tileable: the lattice period divides the canvas size.
 */
export function createCarpetTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#262120';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(210, 190, 170, 0.07)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = -size; i <= size * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, size);
    ctx.lineTo(i + size, 0);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(200, 170, 110, 0.10)';
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  noiseOver(ctx, size, size, 16);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Dark walnut vertical-slat wall panelling with lighting baked into the texture
 * (dark toward the ceiling, soft pool of light at eye level, deeper wainscot with a brass rail line).
 * Tiles horizontally only; one tile = 8 slats.
 */
export function createWallPanelTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const slats = 8;
  const slatW = w / slats;
  const palette = ['#4a2f1c', '#43291a', '#52341f', '#3d2517', '#4d3120', '#46301d', '#3f2818', '#4f331f'];
  for (let i = 0; i < slats; i++) {
    ctx.fillStyle = palette[i % palette.length];
    ctx.fillRect(i * slatW, 0, slatW, h);

    // Long grain striations
    for (let g = 0; g < 18; g++) {
      const gx = i * slatW + 4 + Math.random() * (slatW - 8);
      ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(20, 10, 4, 0.22)' : 'rgba(255, 210, 150, 0.06)';
      ctx.lineWidth = 0.6 + Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + (Math.random() - 0.5) * 6, h * 0.3, gx + (Math.random() - 0.5) * 6, h * 0.7, gx, h);
      ctx.stroke();
    }

    // Shadow gap between slats + a soft bevel highlight
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(i * slatW, 0, 3, h);
    ctx.fillStyle = 'rgba(255, 220, 170, 0.07)';
    ctx.fillRect(i * slatW + 3, 0, 2, h);
  }

  // Baked lighting: top falls into darkness, soft glow at eye level, deeper wainscot band
  const light = ctx.createLinearGradient(0, 0, 0, h);
  light.addColorStop(0.0, 'rgba(0, 0, 0, 0.88)');
  light.addColorStop(0.22, 'rgba(0, 0, 0, 0.55)');
  light.addColorStop(0.5, 'rgba(0, 0, 0, 0.18)');
  light.addColorStop(0.78, 'rgba(0, 0, 0, 0.45)');
  light.addColorStop(1.0, 'rgba(0, 0, 0, 0.72)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, h);

  // Wainscot: darker lower panel capped by a thin brass rail
  const railY = h * 0.76;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, railY, w, h - railY);
  ctx.fillStyle = '#b08a4a';
  ctx.fillRect(0, railY - 3, w, 4);
  ctx.fillStyle = 'rgba(255, 235, 190, 0.35)';
  ctx.fillRect(0, railY - 3, w, 1);

  noiseOver(ctx, w, h, 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft backlit venue sign (transparent background) used on the hall walls. */
export function createSignTexture(text: string): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const halo = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.5);
  halo.addColorStop(0, 'rgba(255, 214, 150, 0.22)');
  halo.addColorStop(1, 'rgba(255, 214, 150, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 112px "Helvetica Neue", Arial, sans-serif';
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '22px';
  const fill = ctx.createLinearGradient(0, h * 0.3, 0, h * 0.7);
  fill.addColorStop(0, '#fff3dc');
  fill.addColorStop(1, '#e2b877');
  ctx.shadowColor = 'rgba(255, 200, 120, 0.7)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = fill;
  ctx.fillText(text, w / 2 + 11, h * 0.46);

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(226, 184, 119, 0.8)';
  ctx.fillRect(w * 0.3, h * 0.78, w * 0.4, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
