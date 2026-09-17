import * as THREE from 'three';
import { TABLE_CONSTANTS, POCKETS, CUSHION_SEGMENTS } from '../physics/constants';
import { BallPhysicsState } from '../physics/types';
import {
  createBallTexture,
  createFeltTexture,
  createHardwoodFloorTexture,
  createSkylineTexture,
  createRugTexture,
  createGalleryArtTexture,
  createGeminiBrandedArtTexture,
  createMahoganyWoodTexture,
  createEnvironmentTexture,
} from './textures';
import { TrajectoryPoint } from '../physics/trajectory';

/**
 * Calculate dynamic cue elevation (pitch angle) and pivot height
 * to guarantee the cue stick cleanly clears cushions, rails, and obstacle balls.
 */
export function calculateCueElevation(
  ballPos: { x: number; z: number },
  aimAngle: number,
  obstacleBalls?: Array<{ x: number; z: number }>
): { pitch: number; yBase: number } {
  const L2 = TABLE_CONSTANTS.TABLE_LENGTH / 2; // 1.27m
  const W2 = TABLE_CONSTANTS.TABLE_WIDTH / 2;  // 0.635m
  const R = TABLE_CONSTANTS.BALL_RADIUS;       // 0.028575m

  // Direction the cue stick extends backwards away from the cue ball
  const cosA = Math.cos(aimAngle);
  const sinA = Math.sin(aimAngle);
  const backX = -cosA;
  const backZ = -sinA;

  // Minimum required height above table when over cushion bevel or wooden rail
  // Rail top is y = 0.048m; plus cushion bevel / rail cap / cue radius + safety margin = 0.066m
  const reqCushionClearanceY = 0.060;
  const reqRailClearanceY = 0.066;

  // Default natural bridge angle on open table (~3.8 deg = 0.066 rad)
  let pitch = 0.066;
  let yBase = R + 0.003;

  // Find distance from ball center along (backX, backZ) to inner cushion edge
  let dCross = Infinity;
  if (backX > 0.001) {
    dCross = Math.min(dCross, (L2 - ballPos.x) / backX);
  } else if (backX < -0.001) {
    dCross = Math.min(dCross, (-L2 - ballPos.x) / backX);
  }

  if (backZ > 0.001) {
    dCross = Math.min(dCross, (W2 - ballPos.z) / backZ);
  } else if (backZ < -0.001) {
    dCross = Math.min(dCross, (-W2 - ballPos.z) / backZ);
  }

  // If the cue stick extends backwards towards a cushion/rail
  if (Number.isFinite(dCross) && dCross > 0) {
    const s1 = (reqCushionClearanceY - yBase) / Math.max(dCross, 0.001);
    const s2 = (reqRailClearanceY - yBase) / (Math.max(dCross, 0.001) + 0.038);
    const reqSin = Math.max(s1, s2);

    const maxPitch = 0.70; // ~40 degrees maximum natural elevation
    const maxSin = Math.sin(maxPitch);

    if (reqSin <= maxSin) {
      if (reqSin > 0) {
        pitch = Math.max(pitch, Math.asin(reqSin));
      }
    } else {
      pitch = maxPitch;
      const hCushion = yBase + dCross * maxSin;
      const hRail = yBase + (dCross + 0.038) * maxSin;
      const lift = Math.max(
        0,
        reqCushionClearanceY - hCushion,
        reqRailClearanceY - hRail
      );
      yBase += lift;
    }
  }

  // Check if any obstacle ball sits directly behind the cue ball along the cue path
  if (obstacleBalls) {
    for (const ob of obstacleBalls) {
      const bx = ob.x - ballPos.x;
      const bz = ob.z - ballPos.z;
      const dProj = bx * backX + bz * backZ;
      if (dProj > 0.02 && dProj < 1.455) {
        const dPerp = Math.sqrt(Math.max(0, (bx * bx + bz * bz) - dProj * dProj));
        if (dPerp < R + 0.015) {
          // Ball is in the cue path! Ball top is at 2*R + 0.005 = 0.062m
          const reqBallH = 2 * R + 0.008;
          const delta = reqBallH - yBase;
          if (delta > 0) {
            const reqSin = delta / dProj;
            if (reqSin < Math.sin(0.70)) {
              pitch = Math.max(pitch, Math.asin(reqSin));
            } else {
              pitch = 0.70;
              yBase = Math.max(yBase, reqBallH - dProj * Math.sin(0.70));
            }
          }
        }
      }
    }
  }

  return { pitch, yBase };
}

export class PoolGameRenderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private ballMeshes: Map<number, THREE.Mesh> = new Map();
  private cueStick: THREE.Group | null = null;
  private trajectoryLine: THREE.Line | null = null;
  private targetBallLine: THREE.Line | null = null;
  private cueReflectLine: THREE.Line | null = null;
  private ghostBallGroup: THREE.Group | null = null;
  private ballInHandGuide: THREE.Group | null = null;
  private guideRingMesh: THREE.Mesh | null = null;
  private guideDiscMesh: THREE.Mesh | null = null;
  private container: HTMLElement;
  private animationFrameId: number | null = null;

  // Camera views
  public cameraMode: 'player' | 'top_down' | 'overhead' = 'player';
  private targetCameraPos = new THREE.Vector3();
  private targetCameraLookAt = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f172a'); // Luxury penthouse twilight ambiance

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(-2.5, 2.0, 0);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // Setup elements
    this.setupEnvironmentMap();
    this.setupLighting();
    this.buildBilliardsRoom();
    this.buildPoolTable();
    this.buildCueStick();
    this.buildTrajectoryVisualizer();
    this.buildBallInHandGuide();

    window.addEventListener('resize', this.onResize);
    this.startRenderLoop();
  }

  /**
   * Generates high-dynamic-range PMREM environment map for authentic realistic reflections
   * on Aramith balls, polished mahogany rails, and chrome fixtures.
   */
  private setupEnvironmentMap() {
    try {
      if (typeof document === 'undefined') return;
      const pmremGen = new THREE.PMREMGenerator(this.renderer);
      pmremGen.compileEquirectangularShader();
      const envTex = createEnvironmentTexture();
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      const envRenderTarget = pmremGen.fromEquirectangular(envTex);
      this.scene.environment = envRenderTarget.texture;
      pmremGen.dispose();
      envTex.dispose();
    } catch (e) {
      console.warn('Environment map initialization skipped:', e);
    }
  }

  private setupLighting() {
    // 1. Warm ambient architectural fill light — calibrated for deep contrast and crisp shadows
    const ambientLight = new THREE.AmbientLight(0xffedd5, 0.38);
    this.scene.add(ambientLight);

    // 2. Hemisphere fill: cool twilight sky from above, warm timber floor bounce from below
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x451a03, 0.28);
    this.scene.add(hemiLight);

    // 3. Billiard overhead twin brass pendant drop lamps (focused pool table illumination)
    const lamp1 = new THREE.SpotLight(0xfffaed, 4.2);
    lamp1.position.set(-0.6, 1.85, 0);
    lamp1.target.position.set(-0.6, 0, 0);
    lamp1.angle = Math.PI / 3.4;
    lamp1.penumbra = 0.35;
    lamp1.castShadow = true;
    lamp1.shadow.mapSize.width = 2048;
    lamp1.shadow.mapSize.height = 2048;
    lamp1.shadow.camera.near = 0.5;
    lamp1.shadow.camera.far = 3.5;
    lamp1.shadow.bias = -0.00008;
    lamp1.shadow.normalBias = 0.005;
    lamp1.shadow.radius = 1.6;
    this.scene.add(lamp1);
    this.scene.add(lamp1.target);

    const lamp2 = new THREE.SpotLight(0xfffaed, 4.2);
    lamp2.position.set(0.6, 1.85, 0);
    lamp2.target.position.set(0.6, 0, 0);
    lamp2.angle = Math.PI / 3.4;
    lamp2.penumbra = 0.35;
    lamp2.castShadow = true;
    lamp2.shadow.mapSize.width = 2048;
    lamp2.shadow.mapSize.height = 2048;
    lamp2.shadow.camera.near = 0.5;
    lamp2.shadow.camera.far = 3.5;
    lamp2.shadow.bias = -0.00008;
    lamp2.shadow.normalBias = 0.005;
    lamp2.shadow.radius = 1.6;
    this.scene.add(lamp2);
    this.scene.add(lamp2.target);

    // 4. Soft warm architectural accent point lights
    // Art gallery spotlight on left wall
    const artLight = new THREE.PointLight(0xfef08a, 1.2, 8);
    artLight.position.set(-5.0, 1.8, 0);
    this.scene.add(artLight);

    // Lounge credenza warm glow on right wall
    const loungeLight = new THREE.PointLight(0xfde047, 1.0, 8);
    loungeLight.position.set(5.0, 0.8, 0);
    this.scene.add(loungeLight);
  }

  private buildBilliardsRoom() {
    const floorY = -TABLE_CONSTANTS.TABLE_HEIGHT;

    // 1. Warm herringbone hardwood parquet floor
    const floorGeo = new THREE.PlaneGeometry(22, 22);
    const floorMat = new THREE.MeshStandardMaterial({
      map: createHardwoodFloorTexture(),
      roughness: 0.4,
      metalness: 0.04,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. Luxury geometric designer area rug centered directly under pool table
    const rugGeo = new THREE.PlaneGeometry(4.8, 3.5);
    const rugMat = new THREE.MeshStandardMaterial({
      map: createRugTexture(),
      roughness: 0.85,
      metalness: 0.02,
    });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, floorY + 0.002, 0); // slightly above floor to prevent z-fighting
    rug.receiveShadow = true;
    this.scene.add(rug);

    // 3. Panoramic floor-to-ceiling skyline window wall (Background, z = -5.5)
    // A. Glowing twilight city skyline backdrop
    const skylineGeo = new THREE.PlaneGeometry(24, 10);
    const skylineMat = new THREE.MeshBasicMaterial({
      map: createSkylineTexture(),
    });
    const skyline = new THREE.Mesh(skylineGeo, skylineMat);
    skyline.position.set(0, 2.2, -5.8);
    this.scene.add(skyline);

    // B. Floor-to-ceiling glass window pane
    const glassGeo = new THREE.PlaneGeometry(24, 6.5);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.08,
      metalness: 0.2,
      transparent: true,
      opacity: 0.16,
    });
    const glassWall = new THREE.Mesh(glassGeo, glassMat);
    glassWall.position.set(0, 1.8, -5.5);
    this.scene.add(glassWall);

    // C. Architectural black steel window mullions / columns
    const mullionMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.5,
      metalness: 0.7,
    });

    // Vertical steel columns
    const colGeo = new THREE.BoxGeometry(0.12, 6.5, 0.15);
    for (const colX of [-8, -5.5, -3, 0, 3, 5.5, 8]) {
      const col = new THREE.Mesh(colGeo, mullionMat);
      col.position.set(colX, 1.8, -5.48);
      this.scene.add(col);
    }

    // Horizontal transom beams
    const beamGeo = new THREE.BoxGeometry(24, 0.12, 0.15);
    for (const beamY of [floorY + 0.06, 0.1, 1.9, 3.4]) {
      const beam = new THREE.Mesh(beamGeo, mullionMat);
      beam.position.set(0, beamY, -5.48);
      this.scene.add(beam);
    }

    // 4. Left Wall: Modern Walnut Wood Slats & Framed Fine Art Gallery (x = -6.5)
    const leftWallGeo = new THREE.PlaneGeometry(16, 6.5);
    const leftWallMat = new THREE.MeshStandardMaterial({
      color: 0x27272a, // dark charcoal plaster
      roughness: 0.85,
    });
    const leftWall = new THREE.Mesh(leftWallGeo, leftWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-6.5, 1.8, 0);
    this.scene.add(leftWall);

    // Vertical walnut wood slats along left wall
    const slatGeo = new THREE.BoxGeometry(0.04, 5.5, 0.08);
    const slatMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21, // warm walnut
      roughness: 0.45,
      metalness: 0.05,
    });
    for (let sz = -4.5; sz <= 4.5; sz += 0.35) {
      if (sz > -1.5 && sz < 1.5) continue; // Leave center space for gallery art
      const slat = new THREE.Mesh(slatGeo, slatMat);
      slat.position.set(-6.44, 1.8, sz);
      this.scene.add(slat);
    }

    // Framed modern gallery art piece
    const artCanvasGeo = new THREE.PlaneGeometry(2.4, 1.5);
    const artCanvasMat = new THREE.MeshStandardMaterial({
      map: createGalleryArtTexture(),
      roughness: 0.6,
    });
    const artCanvas = new THREE.Mesh(artCanvasGeo, artCanvasMat);
    artCanvas.rotation.y = Math.PI / 2;
    artCanvas.position.set(-6.42, 1.3, 0);
    this.scene.add(artCanvas);

    // Brushed brass frame around artwork
    const artFrameMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.85,
    });
    const frameTopGeo = new THREE.BoxGeometry(0.06, 0.06, 2.52);
    const frameTop = new THREE.Mesh(frameTopGeo, artFrameMat);
    frameTop.position.set(-6.40, 2.08, 0);
    this.scene.add(frameTop);

    const frameBottom = new THREE.Mesh(frameTopGeo, artFrameMat);
    frameBottom.position.set(-6.40, 0.52, 0);
    this.scene.add(frameBottom);

    const frameSideGeo = new THREE.BoxGeometry(0.06, 1.62, 0.06);
    const frameL = new THREE.Mesh(frameSideGeo, artFrameMat);
    frameL.position.set(-6.40, 1.3, -1.23);
    this.scene.add(frameL);

    const frameR = new THREE.Mesh(frameSideGeo, artFrameMat);
    frameR.position.set(-6.40, 1.3, 1.23);
    this.scene.add(frameR);

    // Wall-mounted cue stand on left wall (sz = -2.8)
    const rackBaseGeo = new THREE.BoxGeometry(0.08, 0.05, 0.8);
    const rackWoodMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.4 });
    const rackBase = new THREE.Mesh(rackBaseGeo, rackWoodMat);
    rackBase.position.set(-6.42, 0.1, -2.8);
    this.scene.add(rackBase);

    const rackTop = new THREE.Mesh(rackBaseGeo, rackWoodMat);
    rackTop.position.set(-6.42, 1.8, -2.8);
    this.scene.add(rackTop);

    // 4 decorative cues standing in wall rack
    const wallCueGeo = new THREE.CylinderGeometry(0.007, 0.014, 1.45, 12);
    const wallCueMat = new THREE.MeshStandardMaterial({ color: 0xdec69a, roughness: 0.4 });
    for (let c = 0; c < 4; c++) {
      const cue = new THREE.Mesh(wallCueGeo, wallCueMat);
      cue.position.set(-6.38, 0.95, -3.1 + c * 0.2);
      this.scene.add(cue);
    }

    // 5. Right Wall: Luxury Penthouse Bar & Lounge Credenza (x = 6.5)
    const rightWallGeo = new THREE.PlaneGeometry(16, 6.5);
    const rightWallMat = new THREE.MeshStandardMaterial({
      color: 0x1f242d, // dark slate
      roughness: 0.8,
    });
    const rightWall = new THREE.Mesh(rightWallGeo, rightWallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(6.5, 1.8, 0);
    this.scene.add(rightWall);

    // Floating walnut credenza console
    const credenzaGeo = new THREE.BoxGeometry(0.7, 0.5, 3.2);
    const credenzaMat = new THREE.MeshStandardMaterial({
      color: 0x2e180d,
      roughness: 0.35,
      metalness: 0.05,
    });
    const credenza = new THREE.Mesh(credenzaGeo, credenzaMat);
    credenza.position.set(6.1, floorY + 0.75, 0);
    this.scene.add(credenza);

    // White marble top on credenza
    const marbleGeo = new THREE.BoxGeometry(0.74, 0.04, 3.24);
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
      metalness: 0.1,
    });
    const marbleTop = new THREE.Mesh(marbleGeo, marbleMat);
    marbleTop.position.set(6.1, floorY + 1.02, 0);
    this.scene.add(marbleTop);

    // Crystal decanters on console
    const glassDecanterMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.6,
    });
    for (const dz of [-0.6, 0.0, 0.6]) {
      const decGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.25, 16);
      const dec = new THREE.Mesh(decGeo, glassDecanterMat);
      dec.position.set(6.1, floorY + 1.16, dz);
      this.scene.add(dec);
    }

    // Modern Architectural Feature Painting: "Built with Gemini 3.8 Flash"
    const geminiArtGeo = new THREE.PlaneGeometry(2.6, 1.6);
    const geminiArtMat = new THREE.MeshPhysicalMaterial({
      map: createGeminiBrandedArtTexture(),
      roughness: 0.35,
      metalness: 0.15,
      clearcoat: 0.6,
      clearcoatRoughness: 0.08,
      reflectivity: 0.5,
    });
    const geminiArt = new THREE.Mesh(geminiArtGeo, geminiArtMat);
    geminiArt.rotation.y = -Math.PI / 2;
    geminiArt.position.set(6.42, 1.85, 0);
    this.scene.add(geminiArt);

    // Brushed champagne brass architectural frame around artwork
    const geminiFrameMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.85,
    });
    const gFrameHGeo = new THREE.BoxGeometry(0.06, 0.06, 2.72);
    const gFrameTop = new THREE.Mesh(gFrameHGeo, geminiFrameMat);
    gFrameTop.position.set(6.40, 2.68, 0);
    this.scene.add(gFrameTop);

    const gFrameBottom = new THREE.Mesh(gFrameHGeo, geminiFrameMat);
    gFrameBottom.position.set(6.40, 1.02, 0);
    this.scene.add(gFrameBottom);

    const gFrameVGeo = new THREE.BoxGeometry(0.06, 1.72, 0.06);
    const gFrameL = new THREE.Mesh(gFrameVGeo, geminiFrameMat);
    gFrameL.position.set(6.40, 1.85, -1.33);
    this.scene.add(gFrameL);

    const gFrameR = new THREE.Mesh(gFrameVGeo, geminiFrameMat);
    gFrameR.position.set(6.40, 1.85, 1.33);
    this.scene.add(gFrameR);

    // Dedicated gallery accent spotlight illuminating the Gemini branding
    const artSpot = new THREE.SpotLight(0xfff7ed, 4.5, 6.0, Math.PI / 3.5, 0.45);
    artSpot.position.set(5.8, 3.0, 0);
    artSpot.target = geminiArt;
    this.scene.add(artSpot);
    this.scene.add(artSpot.target);

    // Warm gallery wall-wash picture light bar mounted above the frame
    const lightBarGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2, 16);
    const lightBarMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.2,
      metalness: 0.9,
    });
    const lightBar = new THREE.Mesh(lightBarGeo, lightBarMat);
    lightBar.position.set(6.25, 2.75, 0);
    this.scene.add(lightBar);

    // Brass support brackets mounting the picture light to the wall
    const bracketGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.2, 12);
    for (const bz of [-0.35, 0.35]) {
      const bracket = new THREE.Mesh(bracketGeo, lightBarMat);
      bracket.rotation.z = Math.PI / 2;
      bracket.position.set(6.34, 2.75, bz);
      this.scene.add(bracket);
    }

    // 6. Modern Flush Ceiling with Warm Recessed Downlights (y = 3.5)
    const ceilingGeo = new THREE.PlaneGeometry(22, 22);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x1e2430, // dark charcoal modern ceiling
      roughness: 0.9,
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 3.5;
    this.scene.add(ceiling);

    // 7. Overhead Modern Brass Billiard Pendant Drop Lamps (Centered over table)
    for (const lampX of [-0.6, 0.6]) {
      // Brass cone hood
      const hoodGeo = new THREE.ConeGeometry(0.24, 0.20, 24, 1, true);
      const hoodMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37, // warm brushed brass
        roughness: 0.25,
        metalness: 0.85,
        side: THREE.DoubleSide,
      });
      const hood = new THREE.Mesh(hoodGeo, hoodMat);
      hood.position.set(lampX, 1.85, 0);
      this.scene.add(hood);

      // Glowing interior diffuser disk inside shade
      const glowGeo = new THREE.CircleGeometry(0.20, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xfffaed,
        side: THREE.DoubleSide,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = Math.PI / 2;
      glow.position.set(lampX, 1.76, 0);
      this.scene.add(glow);

      // Brass suspension rod to ceiling
      const rodGeo = new THREE.CylinderGeometry(0.006, 0.006, 1.6, 8);
      const rodMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.9,
        roughness: 0.2,
      });
      const rod = new THREE.Mesh(rodGeo, rodMat);
      rod.position.set(lampX, 2.65, 0);
      this.scene.add(rod);
    }
  }

  private buildPoolTable() {
    const L = TABLE_CONSTANTS.TABLE_LENGTH;
    const W = TABLE_CONSTANTS.TABLE_WIDTH;
    const cushionDepth = 0.038;
    const railWidth = 0.11;
    const railHeight = 0.048;

    // 1. Felt Bed (Playing Cloth Surface extending under cushions)
    const feltTexture = createFeltTexture();
    const feltMat = new THREE.MeshStandardMaterial({
      map: feltTexture,
      roughness: 0.76,
      metalness: 0.0,
    });
    const bedGeo = new THREE.PlaneGeometry(L + cushionDepth * 2, W + cushionDepth * 2);
    const bedMesh = new THREE.Mesh(bedGeo, feltMat);
    bedMesh.rotation.x = -Math.PI / 2;
    bedMesh.position.y = 0;
    bedMesh.receiveShadow = true;
    this.scene.add(bedMesh);

    // 2. Rich Polished Mahogany Rails with clearcoat lacquer reflections
    const woodTexture = createMahoganyWoodTexture();
    const woodMat = new THREE.MeshPhysicalMaterial({
      map: woodTexture,
      roughness: 0.22,
      metalness: 0.06,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });

    // Top & Bottom rails (Z sides)
    const longRailGeo = new THREE.BoxGeometry(L + (cushionDepth + railWidth) * 2, railHeight, railWidth);
    const topRail = new THREE.Mesh(longRailGeo, woodMat);
    topRail.position.set(0, railHeight / 2, -W / 2 - cushionDepth - railWidth / 2);
    topRail.castShadow = false;
    topRail.receiveShadow = true;
    this.scene.add(topRail);

    const bottomRail = new THREE.Mesh(longRailGeo, woodMat);
    bottomRail.position.set(0, railHeight / 2, W / 2 + cushionDepth + railWidth / 2);
    bottomRail.castShadow = false;
    bottomRail.receiveShadow = true;
    this.scene.add(bottomRail);

    // Left & Right rails (X sides)
    const shortRailGeo = new THREE.BoxGeometry(railWidth, railHeight, W + cushionDepth * 2);
    const leftRail = new THREE.Mesh(shortRailGeo, woodMat);
    leftRail.position.set(-L / 2 - cushionDepth - railWidth / 2, railHeight / 2, 0);
    leftRail.castShadow = false;
    leftRail.receiveShadow = true;
    this.scene.add(leftRail);

    const rightRail = new THREE.Mesh(shortRailGeo, woodMat);
    rightRail.position.set(L / 2 + cushionDepth + railWidth / 2, railHeight / 2, 0);
    rightRail.castShadow = false;
    rightRail.receiveShadow = true;
    this.scene.add(rightRail);

    // 2B. Solid Table Cabinet Body / Apron (under-slate box that completely occludes light from shining through to the floor)
    const cabinetLength = L + (cushionDepth + railWidth) * 2;
    const cabinetWidth = W + (cushionDepth + railWidth) * 2;
    const cabinetHeight = 0.20;
    const cabinetGeo = new THREE.BoxGeometry(cabinetLength, cabinetHeight, cabinetWidth);
    const cabinetMesh = new THREE.Mesh(cabinetGeo, woodMat);
    cabinetMesh.position.set(0, -cabinetHeight / 2 - 0.002, 0);
    cabinetMesh.castShadow = true;
    cabinetMesh.receiveShadow = false;
    this.scene.add(cabinetMesh);

    // Decorative lower trim bevel for luxury furniture silhouette
    const trimGeo = new THREE.BoxGeometry(cabinetLength + 0.02, 0.03, cabinetWidth + 0.02);
    const trimMesh = new THREE.Mesh(trimGeo, woodMat);
    trimMesh.position.set(0, -cabinetHeight - 0.002, 0);
    trimMesh.castShadow = true;
    trimMesh.receiveShadow = false;
    this.scene.add(trimMesh);

    // 3. Tournament Cushion Bumpers (Vibrant Simonis emerald cloth with beveled nose profile)
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x0a5438,
      roughness: 0.74,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    for (const segment of CUSHION_SEGMENTS) {
      const cushionMesh = createCushionMesh(segment, cushionMat, cushionDepth);
      this.scene.add(cushionMesh);
    }

    // 4. Mother-of-pearl iridescent rail sight diamond inlays
    const diamondMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.16,
      metalness: 0.25,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      iridescence: 0.9,
      iridescenceIOR: 1.33,
    });

    const createDiamondSight = (x: number, y: number, z: number) => {
      // 4-sided cone rotated creates an authentic diamond/rhombus inlay
      const dMesh = new THREE.Mesh(new THREE.ConeGeometry(0.0055, 0.0025, 4), diamondMat);
      dMesh.rotation.y = Math.PI / 4;
      dMesh.rotation.x = Math.PI; // Inset flush with rail surface
      dMesh.position.set(x, y, z);
      return dMesh;
    };

    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue; // Skip middle pocket gap
      this.scene.add(createDiamondSight((L / 8) * i, railHeight + 0.001, -W / 2 - cushionDepth - railWidth / 2));
      this.scene.add(createDiamondSight((L / 8) * i, railHeight + 0.001, W / 2 + cushionDepth + railWidth / 2));
    }

    for (let i = -1; i <= 1; i++) {
      this.scene.add(createDiamondSight(-L / 2 - cushionDepth - railWidth / 2, railHeight + 0.001, (W / 4) * i));
      this.scene.add(createDiamondSight(L / 2 + cushionDepth + railWidth / 2, railHeight + 0.001, (W / 4) * i));
    }

    // 5. Polished Chrome Table Corner Castings & Deep Pocket Holes
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      metalness: 0.96,
      roughness: 0.10,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });
    // MeshBasicMaterial with polygonOffset guarantees zero Z-fighting with felt bed
    const pocketHoleMat = new THREE.MeshBasicMaterial({
      color: 0x050508,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    for (const pocket of POCKETS) {
      // 1. Dark circular pocket mouth disc sitting solidly on the cloth
      const holeDisc = new THREE.Mesh(
        new THREE.CircleGeometry(pocket.radius * 0.96, 32),
        pocketHoleMat
      );
      holeDisc.rotation.x = -Math.PI / 2;
      holeDisc.position.set(pocket.position.x, 0.0006, pocket.position.z);
      this.scene.add(holeDisc);

      // 2. Open-ended interior drop cup (no top cap to avoid coplanar Z-fighting)
      const cupMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(pocket.radius * 0.95, pocket.radius * 0.82, 0.06, 24, 1, true),
        pocketHoleMat
      );
      cupMesh.position.set(pocket.position.x, -0.03, pocket.position.z);
      this.scene.add(cupMesh);

      // 3. Interior bottom cup base
      const cupBase = new THREE.Mesh(
        new THREE.CircleGeometry(pocket.radius * 0.82, 24),
        pocketHoleMat
      );
      cupBase.rotation.x = -Math.PI / 2;
      cupBase.position.set(pocket.position.x, -0.06, pocket.position.z);
      this.scene.add(cupBase);

      // 4. Chrome pocket castings
      if (pocket.isSide) {
        const signZ = pocket.position.z > 0 ? 1 : -1;
        const sideBracket = new THREE.Mesh(
          new THREE.BoxGeometry(pocket.radius * 2.0, 0.008, 0.032),
          chromeMat
        );
        sideBracket.position.set(0, railHeight + 0.004, pocket.position.z + signZ * (cushionDepth + 0.015));
        sideBracket.castShadow = false;
        sideBracket.receiveShadow = false;
        this.scene.add(sideBracket);
      } else {
        const signX = pocket.position.x > 0 ? 1 : -1;
        const signZ = pocket.position.z > 0 ? 1 : -1;
        const cornerCap = new THREE.Mesh(
          new THREE.BoxGeometry(railWidth * 1.15, 0.008, railWidth * 1.15),
          chromeMat
        );
        cornerCap.position.set(
          pocket.position.x + signX * (cushionDepth * 0.6 + railWidth * 0.45),
          railHeight + 0.004,
          pocket.position.z + signZ * (cushionDepth * 0.6 + railWidth * 0.45)
        );
        cornerCap.castShadow = false;
        cornerCap.receiveShadow = false;
        this.scene.add(cornerCap);
      }
    }

    // 6. Regulation Table Cloth Markings (Headstring / Baulk line, "D" arc, and Spot markers)
    const markingMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.50, // authentic screen-printed cloth chalk marking
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const markingsGroup = new THREE.Group();

    // The Headstring (Baulk Line) across the table at x = -L / 4 (-0.635m)
    const baulkLine = new THREE.Mesh(new THREE.PlaneGeometry(0.003, W), markingMat);
    baulkLine.rotation.x = -Math.PI / 2;
    baulkLine.position.set(-L * 0.25, 0.0004, 0);
    markingsGroup.add(baulkLine);

    // The "D" arc: semi-circle curving into the baulk/kitchen area (radius 0.29m ~ 11.5 inches)
    const dRadius = 0.29;
    const dLineWidth = 0.003;
    const dArcGeo = new THREE.RingGeometry(
      dRadius - dLineWidth / 2,
      dRadius + dLineWidth / 2,
      64,
      1,
      Math.PI * 0.5,
      Math.PI
    );
    const dArc = new THREE.Mesh(dArcGeo, markingMat);
    dArc.rotation.x = -Math.PI / 2;
    dArc.position.set(-L * 0.25, 0.0004, 0);
    markingsGroup.add(dArc);

    // Head Spot (center of the headstring / baulk line where cue ball breaks from)
    const headSpot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 24), markingMat);
    headSpot.rotation.x = -Math.PI / 2;
    headSpot.position.set(-L * 0.25, 0.00045, 0);
    markingsGroup.add(headSpot);

    // Center Spot (middle of the table)
    const centerSpot = new THREE.Mesh(new THREE.CircleGeometry(0.005, 24), markingMat);
    centerSpot.rotation.x = -Math.PI / 2;
    centerSpot.position.set(0, 0.00045, 0);
    markingsGroup.add(centerSpot);

    // Foot Spot (center of rack apex ball at +L / 4)
    const footSpot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 24), markingMat);
    footSpot.rotation.x = -Math.PI / 2;
    footSpot.position.set(L * 0.25, 0.00045, 0);
    markingsGroup.add(footSpot);

    this.scene.add(markingsGroup);

    // 7. Heavy Carved Table Legs (reaching from underside of cabinet to the rug)
    const legHeight = TABLE_CONSTANTS.TABLE_HEIGHT - cabinetHeight - 0.002;
    const legGeo = new THREE.CylinderGeometry(0.085, 0.065, legHeight, 20);
    const legPositions = [
      { x: -L * 0.44, z: -W * 0.40 },
      { x: L * 0.44, z: -W * 0.40 },
      { x: -L * 0.44, z: W * 0.40 },
      { x: L * 0.44, z: W * 0.40 },
    ];
    for (const pos of legPositions) {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(pos.x, -cabinetHeight - 0.002 - legHeight / 2, pos.z);
      leg.castShadow = true;
      leg.receiveShadow = false;
      this.scene.add(leg);

      // Brass foot pad on each leg base
      const footPad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.085, 0.025, 20),
        new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 })
      );
      footPad.position.set(pos.x, -TABLE_CONSTANTS.TABLE_HEIGHT + 0.0125, pos.z);
      footPad.castShadow = true;
      this.scene.add(footPad);
    }
  }

  private buildCueStick() {
    const cueGroup = new THREE.Group();
    this.cueStick = cueGroup;

    // Helper to add cylindrical cue sections aligned along local +Z axis (tip at z = 0)
    const addSection = (
      radiusNear: number,
      radiusFar: number,
      length: number,
      zCenter: number,
      material: THREE.Material
    ) => {
      // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
      // With rotation.x = Math.PI / 2, radiusTop (+y) is at +z, radiusBottom (-y) is at -z.
      const geo = new THREE.CylinderGeometry(radiusFar, radiusNear, length, 24);
      const mesh = new THREE.Mesh(geo, material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.z = zCenter;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      cueGroup.add(mesh);
    };

    // 1. Blue Chalk Tip (z: 0.000 -> 0.008)
    const chalkMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.92 });
    addSection(0.006, 0.006, 0.008, 0.004, chalkMat);

    // 2. Ivory White Ferrule (z: 0.008 -> 0.030)
    const ferruleMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbfbfa,
      roughness: 0.15,
      clearcoat: 0.85,
    });
    addSection(0.006, 0.0064, 0.022, 0.019, ferruleMat);

    // 3. Silky Canadian Maple Shaft (z: 0.030 -> 0.880, gently tapered)
    const shaftMat = new THREE.MeshPhysicalMaterial({
      color: 0xf6ebd7,
      roughness: 0.28,
      metalness: 0.02,
      clearcoat: 0.40,
    });
    addSection(0.0064, 0.010, 0.850, 0.455, shaftMat);

    // 4. Polished Stainless Steel Joint Collar (z: 0.880 -> 0.905)
    const steelMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      roughness: 0.10,
      metalness: 0.96,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });
    addSection(0.010, 0.0106, 0.025, 0.8925, steelMat);

    // 5. Dark Burl Walnut Forearm (z: 0.905 -> 1.085)
    const woodMat = new THREE.MeshPhysicalMaterial({
      color: 0x2e1408,
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.10,
    });
    addSection(0.0106, 0.013, 0.180, 0.995, woodMat);

    // 6. Irish Linen Grip Wrap (z: 1.085 -> 1.365)
    const wrapMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85,
      metalness: 0.05,
    });
    addSection(0.013, 0.0135, 0.280, 1.225, wrapMat);

    // 7. Polished Ebony Butt Sleeve (z: 1.365 -> 1.435)
    const buttMat = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.90,
      clearcoatRoughness: 0.08,
    });
    addSection(0.0135, 0.014, 0.070, 1.400, buttMat);

    // 8. Black Rubber Bumper (z: 1.435 -> 1.455)
    const bumperMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.95,
      metalness: 0.0,
    });
    addSection(0.014, 0.012, 0.020, 1.445, bumperMat);

    this.scene.add(this.cueStick);
    this.cueStick.visible = false;
  }

  private buildTrajectoryVisualizer() {
    // 1. Cue trajectory line (flush just above felt, zero parallax)
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 0.035,
      gapSize: 0.015,
      linewidth: 2,
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    this.trajectoryLine = new THREE.Line(lineGeo, lineMat);
    this.trajectoryLine.computeLineDistances();
    this.scene.add(this.trajectoryLine);

    // 2. Deflected target ball line (luminous electric cyan)
    const targetLineMat = new THREE.LineDashedMaterial({
      color: 0x00f0ff,
      dashSize: 0.03,
      gapSize: 0.015,
    });
    const targetLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    this.targetBallLine = new THREE.Line(targetLineGeo, targetLineMat);
    this.scene.add(this.targetBallLine);

    // 3. Cue ball deflection or cushion rebound line (warm gold)
    const reflectLineMat = new THREE.LineDashedMaterial({
      color: 0xfde047,
      dashSize: 0.025,
      gapSize: 0.015,
    });
    const reflectLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    this.cueReflectLine = new THREE.Line(reflectLineGeo, reflectLineMat);
    this.scene.add(this.cueReflectLine);

    // 4. Ghost ball sleek contact indicator (outer luminous ring + inner translucent disc)
    const ghostGroup = new THREE.Group();
    this.ghostBallGroup = ghostGroup;
    const R = TABLE_CONSTANTS.BALL_RADIUS;

    // Table footprint outer ring
    const ringGeo = new THREE.RingGeometry(R * 0.88, R, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.0025;
    ghostGroup.add(ringMesh);

    // Table footprint translucent fill disc
    const discGeo = new THREE.CircleGeometry(R * 0.88, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.20,
      side: THREE.DoubleSide,
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.x = -Math.PI / 2;
    discMesh.position.y = 0.0024;
    ghostGroup.add(discMesh);

    // Impact center point
    const centerGeo = new THREE.CircleGeometry(0.0035, 16);
    const centerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    centerMesh.rotation.x = -Math.PI / 2;
    centerMesh.position.y = 0.0026;
    ghostGroup.add(centerMesh);

    this.scene.add(ghostGroup);
    ghostGroup.visible = false;
  }

  /**
   * Builds the luminous 3D table surface guide indicator for Ball-in-Hand positioning
   */
  private buildBallInHandGuide() {
    const R = TABLE_CONSTANTS.BALL_RADIUS;
    this.ballInHandGuide = new THREE.Group();
    this.ballInHandGuide.visible = false;

    // Glowing circle ring on table surface
    const ringGeo = new THREE.RingGeometry(R * 1.05, R * 1.35, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.guideRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.guideRingMesh.rotation.x = -Math.PI / 2;
    this.guideRingMesh.position.y = 0.0012;
    this.ballInHandGuide.add(this.guideRingMesh);

    // Semi-transparent inner base disc
    const discGeo = new THREE.CircleGeometry(R * 1.02, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.guideDiscMesh = new THREE.Mesh(discGeo, discMat);
    this.guideDiscMesh.rotation.x = -Math.PI / 2;
    this.guideDiscMesh.position.y = 0.001;
    this.ballInHandGuide.add(this.guideDiscMesh);

    this.scene.add(this.ballInHandGuide);
  }

  /**
   * Update or toggle the Ball-in-Hand positioning ring
   */
  public updateBallInHandGuide(visible: boolean, pos?: { x: number; z: number }, isValid: boolean = true) {
    if (!this.ballInHandGuide) return;
    this.ballInHandGuide.visible = visible;

    if (visible && pos) {
      this.ballInHandGuide.position.set(pos.x, 0, pos.z);
      const color = isValid ? 0x10b981 : 0xf43f5e; // Emerald when valid, Rose when colliding
      if (this.guideRingMesh) {
        (this.guideRingMesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      }
      if (this.guideDiscMesh) {
        (this.guideDiscMesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      }
    }
  }

  /**
   * Raycast from screen coordinates (clientX, clientY) to the horizontal table playing bed (Y = 0)
   */
  public getTableIntersection(clientX: number, clientY: number): { x: number; z: number } | null {
    if (!this.renderer || !this.camera) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(tablePlane, target);
    if (hit) {
      return { x: target.x, z: target.z };
    }
    return null;
  }

  /**
   * Synchronize 3D meshes with physics ball states
   */
  public updateBalls(balls: BallPhysicsState[]) {
    const R = TABLE_CONSTANTS.BALL_RADIUS;

    for (const b of balls) {
      let mesh = this.ballMeshes.get(b.id);

      if (!mesh) {
        // Ultra-smooth 64x48 sphere geometry eliminates polygon faceting
        const geo = new THREE.SphereGeometry(R, 64, 48);
        const texture = createBallTexture(b.id);
        // Authentic Aramith Phenolic Resin PBR material with mirror clearcoat and refractive index
        const mat = new THREE.MeshPhysicalMaterial({
          map: texture,
          roughness: 0.06,
          metalness: 0.02,
          clearcoat: 1.0,
          clearcoatRoughness: 0.02,
          ior: 1.54,
          reflectivity: 0.55,
        });

        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.ballMeshes.set(b.id, mesh);
      }

      if (b.state === 'pocketed') {
        mesh.visible = false;
        mesh.userData.lastPos = null;
      } else {
        mesh.visible = true;
        mesh.position.set(b.position.x, R + b.height, b.position.z);

        // 1:1 Physical rolling rotation strictly coupled to surface displacement
        const lastPos = mesh.userData.lastPos as { x: number; z: number } | undefined;
        if (lastPos) {
          const dx = b.position.x - lastPos.x;
          const dz = b.position.z - lastPos.z;
          const dist = Math.hypot(dx, dz);

          if (dist > 0.00001) {
            // Authentic no-slip rolling rotation:
            // For a sphere rolling on the x-z plane with +y up:
            // Travel vector is (dx, 0, dz).
            // Rolling rotation axis is (dz / dist, 0, -dx / dist).
            // Angle rotated is dist / R radians.
            const rollAngle = dist / R;
            const rollAxis = new THREE.Vector3(dz / dist, 0, -dx / dist);
            const rollQuat = new THREE.Quaternion().setFromAxisAngle(rollAxis, rollAngle);
            mesh.quaternion.premultiply(rollQuat);
          }
        }

        // Apply physical sliding slip (backspin/topspin differential while sliding)
        if (b.state === 'sliding') {
          // Angular slip difference between current angular velocity and pure rolling velocity
          const wxSlip = b.angularVelocity.x - (b.velocity.z / R);
          const wzSlip = b.angularVelocity.z - (-b.velocity.x / R);
          const slipSpeed = Math.hypot(wxSlip, wzSlip);
          if (slipSpeed > 0.05) {
            const now = performance.now();
            const lastTime = (mesh.userData.lastTime as number) || now;
            const dt = Math.min(Math.max((now - lastTime) / 1000, 0.005), 0.033);
            const slipAxis = new THREE.Vector3(wxSlip / slipSpeed, 0, wzSlip / slipSpeed);
            const slipQuat = new THREE.Quaternion().setFromAxisAngle(slipAxis, slipSpeed * dt);
            mesh.quaternion.premultiply(slipQuat);
          }
        }

        // Apply vertical English spin around Y axis
        if (Math.abs(b.angularVelocity.y) > 0.01) {
          const now = performance.now();
          const lastTime = (mesh.userData.lastTime as number) || now;
          const dt = Math.min(Math.max((now - lastTime) / 1000, 0.005), 0.033);
          const spinAngle = b.angularVelocity.y * dt;
          const spinQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spinAngle);
          mesh.quaternion.premultiply(spinQuat);
        }

        mesh.userData.lastPos = { x: b.position.x, z: b.position.z };
        mesh.userData.lastTime = performance.now();
      }
    }
  }

  /**
   * Update visual cue stick position, angle, and pullback distance
   */
  public updateCueStick(
    cueBall: BallPhysicsState | undefined,
    aimAngle: number,
    pullback: number = 0,
    visible: boolean = true
  ) {
    if (!this.cueStick || !cueBall || cueBall.state === 'pocketed' || cueBall.state === 'falling') {
      if (this.cueStick) this.cueStick.visible = false;
      return;
    }

    this.cueStick.visible = visible;
    if (!visible) return;

    const R = TABLE_CONSTANTS.BALL_RADIUS;

    // Collect other active ball positions to avoid clipping over obstacle balls
    const obstacleBalls: Array<{ x: number; z: number }> = [];
    if (this.ballMeshes) {
      for (const [id, mesh] of this.ballMeshes.entries()) {
        if (id !== 0 && mesh.visible) {
          obstacleBalls.push({ x: mesh.position.x, z: mesh.position.z });
        }
      }
    }

    // Dynamically calculate elevation angle and pivot height to clear cushions & rails
    const { pitch, yBase } = calculateCueElevation(cueBall.position, aimAngle, obstacleBalls);

    const cosA = Math.cos(aimAngle);
    const sinA = Math.sin(aimAngle);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    // Tip position along elevated cue axis with smooth power pullback
    const distanceOffset = R + 0.015 + pullback * 0.22;
    const tipX = cueBall.position.x - cosA * distanceOffset * cosP;
    const tipZ = cueBall.position.z - sinA * distanceOffset * cosP;
    const tipY = yBase + distanceOffset * sinP;

    this.cueStick.position.set(tipX, tipY, tipZ);

    // Orientation: local +Z (butt) extends backwards and elevated away from cue ball
    this.cueStick.rotation.order = 'YXZ';
    this.cueStick.rotation.y = -aimAngle - Math.PI / 2;
    this.cueStick.rotation.x = -pitch;
  }

  /**
   * Update aim trajectory guideline & ghost ball
   */
  public updateTrajectory(traj: TrajectoryPoint | null, visible: boolean = true) {
    if (!visible || !traj) {
      if (this.trajectoryLine) this.trajectoryLine.visible = false;
      if (this.targetBallLine) this.targetBallLine.visible = false;
      if (this.cueReflectLine) this.cueReflectLine.visible = false;
      if (this.ghostBallGroup) this.ghostBallGroup.visible = false;
      return;
    }

    const yGuideline = 0.0025; // Flush above table felt bed - zero parallax!

    // 1. Primary cue ball aiming guideline (emerges seamlessly from cue ball surface)
    if (this.trajectoryLine) {
      this.trajectoryLine.visible = true;
      const points = [
        new THREE.Vector3(traj.cueStart.x, yGuideline, traj.cueStart.z),
        new THREE.Vector3(traj.cueHitPoint.x, yGuideline, traj.cueHitPoint.z),
      ];
      this.trajectoryLine.geometry.setFromPoints(points);
      this.trajectoryLine.computeLineDistances();
    }

    // 2. Ghost ball indicator at point of impact
    if (this.ghostBallGroup && traj.targetBallId !== undefined) {
      this.ghostBallGroup.visible = true;
      this.ghostBallGroup.position.set(traj.cueHitPoint.x, 0, traj.cueHitPoint.z);
    } else if (this.ghostBallGroup) {
      this.ghostBallGroup.visible = false;
    }

    // 3. Target ball deflected path (luminous electric cyan)
    if (this.targetBallLine && traj.targetBallStart && traj.targetBallDir) {
      this.targetBallLine.visible = true;
      const targetLen = 0.50;
      const points = [
        new THREE.Vector3(traj.targetBallStart.x, yGuideline, traj.targetBallStart.z),
        new THREE.Vector3(
          traj.targetBallStart.x + traj.targetBallDir.x * targetLen,
          yGuideline,
          traj.targetBallStart.z + traj.targetBallDir.z * targetLen
        ),
      ];
      this.targetBallLine.geometry.setFromPoints(points);
      this.targetBallLine.computeLineDistances();
    } else if (this.targetBallLine) {
      this.targetBallLine.visible = false;
    }

    // 4. Cue ball deflection or cushion rebound path (warm gold)
    const reflectDir = traj.cueReflectDir || traj.cushionReflectDir;
    if (this.cueReflectLine && reflectDir) {
      this.cueReflectLine.visible = true;
      const reflectLen = 0.35;
      const points = [
        new THREE.Vector3(traj.cueHitPoint.x, yGuideline, traj.cueHitPoint.z),
        new THREE.Vector3(
          traj.cueHitPoint.x + reflectDir.x * reflectLen,
          yGuideline,
          traj.cueHitPoint.z + reflectDir.z * reflectLen
        ),
      ];
      this.cueReflectLine.geometry.setFromPoints(points);
      this.cueReflectLine.computeLineDistances();
    } else if (this.cueReflectLine) {
      this.cueReflectLine.visible = false;
    }
  }

  /**
   * Set dynamic camera positioning
   */
  public updateCamera(cueBall?: BallPhysicsState, aimAngle: number = 0, isBallInHand: boolean = false) {
    if (this.cameraMode === 'overhead') {
      // Tactical top-down view
      this.targetCameraPos.set(0, 3.2, 0);
      this.targetCameraLookAt.set(0, 0, 0);
    } else if (isBallInHand) {
      // Elevated perspective view for intuitive ball placement across entire table
      this.targetCameraPos.set(0, 2.3, 1.75);
      this.targetCameraLookAt.set(0, 0, 0);
    } else if (cueBall) {
      // Over-the-shoulder cue aiming view
      const camDist = 1.35;
      const camHeight = 0.65;
      const cosA = Math.cos(aimAngle);
      const sinA = Math.sin(aimAngle);

      this.targetCameraPos.set(
        cueBall.position.x - cosA * camDist,
        camHeight,
        cueBall.position.z - sinA * camDist
      );
      this.targetCameraLookAt.set(
        cueBall.position.x + cosA * 0.8,
        TABLE_CONSTANTS.BALL_RADIUS,
        cueBall.position.z + sinA * 0.8
      );
    }

    // Smooth lerp camera movement
    this.camera.position.lerp(this.targetCameraPos, 0.08);
    this.camera.lookAt(this.targetCameraLookAt);
  }

  private onResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private startRenderLoop() {
    const loop = () => {
      this.renderer.render(this.scene, this.camera);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}

/**
 * Procedural 3D cushion bumper with beveled nose and angled pocket mouth cutoffs
 */
function createCushionMesh(
  segment: {
    start: { x: number; z: number };
    end: { x: number; z: number };
    normal: { x: number; z: number };
  },
  material: THREE.Material,
  depth: number = 0.038
): THREE.Mesh {
  const sx = segment.start.x;
  const sz = segment.start.z;
  const ex = segment.end.x;
  const ez = segment.end.z;
  const nx = segment.normal.x;
  const nz = segment.normal.z;

  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.hypot(dx, dz);
  const tx = dx / len;
  const tz = dz / len;

  const yNose = 0.032; // ball impact nose height
  const yTop = 0.042;  // top shelf height (below wooden rail top at 0.048)
  const yBase = 0.001; // felt bed level
  const bevel = 0.024; // pocket mouth jaw bevel

  // Vertices at Start
  const p1 = [sx, yNose, sz]; // nose
  const p2 = [sx - nx * 0.005, yBase, sz - nz * 0.005]; // undercut base
  const p3 = [sx - nx * 0.014, yTop, sz - nz * 0.014]; // top bevel
  const p4 = [sx - nx * depth - tx * bevel, yTop, sz - nz * depth - tz * bevel]; // rear top
  const p5 = [sx - nx * depth - tx * bevel, yBase, sz - nz * depth - tz * bevel]; // rear base

  // Vertices at End
  const q1 = [ex, yNose, ez]; // nose
  const q2 = [ex - nx * 0.005, yBase, ez - nz * 0.005]; // undercut base
  const q3 = [ex - nx * 0.014, yTop, ez - nz * 0.014]; // top bevel
  const q4 = [ex - nx * depth + tx * bevel, yTop, ez - nz * depth + tz * bevel]; // rear top
  const q5 = [ex - nx * depth + tx * bevel, yBase, ez - nz * depth + tz * bevel]; // rear base

  const positions: number[] = [];

  const addTri = (a: number[], b: number[], c: number[]) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };

  const addQuad = (a: number[], b: number[], c: number[], d: number[]) => {
    addTri(a, b, c);
    addTri(a, c, d);
  };

  // 1. Slanted top nose face (slopes up from nose to top bevel)
  addQuad(p1, q1, q3, p3);

  // 2. Undercut nose face (from base up to nose)
  addQuad(p2, q2, q1, p1);

  // 3. Top flat face
  addQuad(p3, q3, q4, p4);

  // 4. Back face
  addQuad(p5, q5, q4, p4);

  // 5. Bottom face
  addQuad(p5, p2, q2, q5);

  // 6. Start end-cap (jaw into pocket)
  addTri(p5, p2, p1);
  addTri(p5, p1, p3);
  addTri(p5, p3, p4);

  // 7. End end-cap (jaw into pocket)
  addTri(q2, q5, q4);
  addTri(q2, q4, q3);
  addTri(q2, q3, q1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}
