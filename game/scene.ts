import * as THREE from 'three';
import { TABLE_CONSTANTS, POCKETS, CUSHION_SEGMENTS } from '../physics/constants';
import { BallPhysicsState } from '../physics/types';
import {
  createBallTexture,
  createFeltTexture,
  createMahoganyWoodTexture,
  createEnvironmentTexture,
  createCarpetTexture,
  createWallPanelTexture,
  createSignTexture,
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

  /** Called once per animation frame, right before rendering, so game state is never a frame behind. */
  public onFrame: ((nowMs: number) => void) | null = null;

  // Adaptive resolution: trade pixel density for a steady frame rate on weak GPUs
  private readonly maxPixelRatio: number;
  private pixelRatio: number;
  private lastFrameTs = 0;
  private perfFrames = 0;
  private perfTimeMs = 0;
  private stableMs = 0;
  private bannedRatio = Infinity;
  private bannedUntil = 0;
  private shadowDirty = true;
  private maxAnisotropy = 1;
  private sharedBallGeometry: THREE.SphereGeometry | null = null;
  private vignette: HTMLDivElement | null = null;
  private lampFixture: THREE.Group | null = null;

  // Camera views
  public cameraMode: 'player' | 'top_down' | 'overhead' = 'player';
  private targetCameraPos = new THREE.Vector3();
  private targetCameraLookAt = new THREE.Vector3();
  private cameraLerp = 0.08; // per-frame factor, refreshed from the real frame time every frame

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#08090b');
    // Far walls dissolve into darkness so the lit table is the clear focal point
    this.scene.fog = new THREE.Fog(0x08090b, 8, 18);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.adjustCameraFov();
    this.camera.position.set(-2.5, 2.0, 0);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.pixelRatio = Math.min(this.maxPixelRatio, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Shadows only re-render when a ball actually moved (see markShadowsDirty)
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    // Khronos PBR Neutral keeps the cloth and ball colours true (ACES desaturates greens)
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.addVignette(container);

    // Setup elements
    this.setupEnvironmentMap();
    this.setupLighting();
    this.buildBilliardsRoom();
    this.buildPoolTable();
    this.applyTextureQuality();
    this.buildCueStick();
    this.buildTrajectoryVisualizer();
    this.buildBallInHandGuide();

    window.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
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
      this.scene.environmentIntensity = 1.25;
      pmremGen.dispose();
      envTex.dispose();
    } catch (e) {
      console.warn('Environment map initialization skipped:', e);
    }
  }

  /** Soft cinematic edge falloff; a CSS overlay costs nothing on the GPU and never intercepts input. */
  private addVignette(container: HTMLElement) {
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    const v = document.createElement('div');
    v.setAttribute('aria-hidden', 'true');
    v.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:1;' +
      'background:radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.38) 100%);';
    container.appendChild(v);
    this.vignette = v;
  }

  private setupLighting() {
    // Every light costs every lit fragment, so the rig is deliberately small:
    // ambient + hemisphere fill, three pendant lamps (only the centre one casts a shadow).
    // The far wall is emissive and the PMREM environment map provides the rest of the room's ambience.
    const ambientLight = new THREE.AmbientLight(0xfff4e6, 0.42);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xdbe4ff, 0x1a120c, 0.38);
    this.scene.add(hemiLight);

    // Billiard overhead tournament 3-shade pendant fixture
    const lamps: Array<{ x: number; intensity: number; shadow: boolean }> = [
      { x: 0.0, intensity: 8.2, shadow: true },
      { x: -0.7, intensity: 2.6, shadow: false },
      { x: 0.7, intensity: 2.6, shadow: false },
    ];
    for (const { x: lx, intensity, shadow } of lamps) {
      const lamp = new THREE.SpotLight(0xfffaed, intensity);
      lamp.position.set(lx, 1.85, 0);
      lamp.target.position.set(lx, 0, 0);
      lamp.angle = Math.PI / 3.4;
      lamp.penumbra = 0.40;
      if (shadow) {
        lamp.castShadow = true;
        lamp.shadow.mapSize.set(2048, 2048);
        lamp.shadow.camera.near = 0.5;
        lamp.shadow.camera.far = 3.5;
        // Tighten the shadow frustum around the table: ~35% more texels per ball => crisper shadows
        lamp.shadow.focus = 0.8;
        lamp.shadow.bias = -0.00008;
        lamp.shadow.normalBias = 0.004;
        lamp.shadow.radius = 2.0;
      }
      this.scene.add(lamp);
      this.scene.add(lamp.target);
    }
  }

  private buildBilliardsRoom() {
    const floorY = -TABLE_CONSTANTS.TABLE_HEIGHT;
    const ceilingY = 3.5;
    const HALF_X = 7.2;
    const HALF_Z = 4.8;
    const wallH = ceilingY - floorY;
    const wallMidY = (ceilingY + floorY) / 2;

    // Everything structural uses unlit (baked) materials: the lighting is painted into the textures,
    // which looks richer than dynamic lights and costs almost nothing per pixel.

    // 1. Deep tournament carpet
    const carpetTex = createCarpetTexture();
    carpetTex.repeat.set(18, 12);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_X * 2, HALF_Z * 2),
      new THREE.MeshPhongMaterial({
        map: carpetTex,
        // Self-lit by the same pattern so the room floor stays readable outside the lamp's pool of light
        emissive: 0x4a413c,
        emissiveMap: carpetTex,
        specular: 0x080706,
        shininess: 6,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY;
    this.scene.add(floor);

    // 2. Walnut slat walls with baked lighting
    const panelTex = createWallPanelTexture();
    const makeWall = (width: number, x: number, z: number, rotY: number) => {
      const tex = panelTex.clone();
      tex.repeat.set(Math.round(width / 0.64), 1);
      tex.needsUpdate = true;
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(width, wallH),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      wall.position.set(x, wallMidY, z);
      wall.rotation.y = rotY;
      this.scene.add(wall);
    };
    makeWall(HALF_Z * 2, -HALF_X, 0, Math.PI / 2);
    makeWall(HALF_Z * 2, HALF_X, 0, -Math.PI / 2);
    makeWall(HALF_X * 2, 0, -HALF_Z, 0);
    makeWall(HALF_X * 2, 0, HALF_Z, Math.PI);

    // 3. Ceiling
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_X * 2, HALF_Z * 2),
      new THREE.MeshBasicMaterial({ color: 0x0a0c11 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ceilingY;
    this.scene.add(ceiling);

    // 4. Warm LED strips along the wall bases and a cool cove strip under the ceiling
    const ledWarm = new THREE.MeshBasicMaterial({ color: 0xb8803f });
    const ledCool = new THREE.MeshBasicMaterial({ color: 0x8fa3c4 });
    const addStrip = (mat: THREE.Material, length: number, x: number, y: number, z: number, alongX: boolean) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? length : 0.012, 0.012, alongX ? 0.012 : length),
        mat
      );
      m.position.set(x, y, z);
      this.scene.add(m);
    };
    for (const [mat, y] of [[ledWarm, floorY + 0.045], [ledCool, ceilingY - 0.06]] as const) {
      addStrip(mat, HALF_X * 2, 0, y, -HALF_Z + 0.02, true);
      addStrip(mat, HALF_X * 2, 0, y, HALF_Z - 0.02, true);
      addStrip(mat, HALF_Z * 2, -HALF_X + 0.02, y, 0, false);
      addStrip(mat, HALF_Z * 2, HALF_X - 0.02, y, 0, false);
    }

    // 5. Venue signage on the two long walls
    const signMat = new THREE.MeshBasicMaterial({
      map: createSignTexture('POOL ARENA'),
      transparent: true,
      depthWrite: false,
    });
    const signGeo = new THREE.PlaneGeometry(3.6, 0.9);
    const signBack = new THREE.Mesh(signGeo, signMat);
    signBack.position.set(0, 1.55, -HALF_Z + 0.015);
    this.scene.add(signBack);
    const signFront = new THREE.Mesh(signGeo, signMat);
    signFront.position.set(0, 1.55, HALF_Z - 0.015);
    signFront.rotation.y = Math.PI;
    this.scene.add(signFront);

    // 6. Wall-mounted cue rack with house cues
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.45, metalness: 0.05 });
    const rackGroup = new THREE.Group();
    rackGroup.position.set(-HALF_X + 0.05, 0, -1.6);
    const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.35, 0.95), darkWood);
    backplate.position.set(0, 0.95, 0);
    rackGroup.add(backplate);
    for (const y of [0.42, 1.42]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.0), darkWood);
      rail.position.set(0.04, y, 0);
      rackGroup.add(rail);
    }
    const houseCueGeo = new THREE.CylinderGeometry(0.0065, 0.0135, 1.3, 12);
    const houseCueMat = new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 0.4 });
    for (let c = 0; c < 6; c++) {
      const cue = new THREE.Mesh(houseCueGeo, houseCueMat);
      cue.position.set(0.04, 0.95, -0.4 + c * 0.16);
      rackGroup.add(cue);
    }
    this.scene.add(rackGroup);

    // 7. Tournament overhead fixture: slim black housing, long opal diffuser, steel suspension
    const fixture = new THREE.Group();
    this.lampFixture = fixture;
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.09, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.38, metalness: 0.55 })
    );
    housing.position.set(0, 1.97, 0);
    fixture.add(housing);
    const diffuser = new THREE.Mesh(
      new THREE.PlaneGeometry(2.02, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xfff6e4 })
    );
    diffuser.rotation.x = Math.PI / 2;
    diffuser.position.set(0, 1.924, 0);
    fixture.add(diffuser);
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.3, metalness: 0.9 });
    const wireLen = ceilingY - 2.0;
    for (const wx of [-0.8, 0.8]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, wireLen, 6), wireMat);
      wire.position.set(wx, 2.0 + wireLen / 2, 0);
      fixture.add(wire);
    }
    this.scene.add(fixture);

    // 8. Blue chalk cube resting on the table's corner rail
    const chalkMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.65 });
    const chalkHollowMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.95 });
    const chalk = new THREE.Group();
    chalk.position.set(1.28, 0.048 + 0.012, 0.66);
    chalk.rotation.y = 0.35;
    chalk.add(new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.022, 0.024), chalkMat));
    const divot = new THREE.Mesh(new THREE.CircleGeometry(0.007, 16), chalkHollowMat);
    divot.rotation.x = -Math.PI / 2;
    divot.position.set(0, 0.0115, 0);
    chalk.add(divot);
    this.scene.add(chalk);
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
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.3,
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
      emissive: 0x1e293b,
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

    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x1d130d, roughness: 0.55, metalness: 0.05 });

    for (const pocket of POCKETS) {
      // 1. Dark circular pocket mouth disc sitting solidly on the cloth
      const holeDisc = new THREE.Mesh(
        new THREE.CircleGeometry(pocket.radius * 0.96, 32),
        pocketHoleMat
      );
      holeDisc.rotation.x = -Math.PI / 2;
      holeDisc.position.set(pocket.position.x, 0.0006, pocket.position.z);
      this.scene.add(holeDisc);

      // Stitched leather pocket liner ringing the mouth
      const liner = new THREE.Mesh(
        new THREE.TorusGeometry(pocket.radius * 0.98, 0.0065, 8, 32),
        leatherMat
      );
      liner.rotation.x = -Math.PI / 2;
      liner.position.set(pocket.position.x, 0.004, pocket.position.z);
      this.scene.add(liner);

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

    // Soft contact occlusion where the cloth meets the cushion rubber (the spot-light shadow can't produce this)
    const aoCanvas = document.createElement('canvas');
    aoCanvas.width = 4;
    aoCanvas.height = 64;
    const aoCtx = aoCanvas.getContext('2d')!;
    const aoGrad = aoCtx.createLinearGradient(0, 0, 0, 64);
    aoGrad.addColorStop(0, 'rgba(0,0,0,0.42)');
    aoGrad.addColorStop(1, 'rgba(0,0,0,0)');
    aoCtx.fillStyle = aoGrad;
    aoCtx.fillRect(0, 0, 4, 64);
    const aoTex = new THREE.CanvasTexture(aoCanvas);
    const aoMat = new THREE.MeshBasicMaterial({
      map: aoTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const aoWidth = 0.07;
    const addAo = (length: number, x: number, z: number, rotZ: number) => {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(length, aoWidth), aoMat);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = rotZ;
      strip.position.set(x, 0.0005, z);
      this.scene.add(strip);
    };
    // Gradient runs from the cushion (dark) inward; planes are oriented so the texture's top edge is the cushion side
    addAo(L, 0, -W / 2 + aoWidth / 2, 0);
    addAo(L, 0, W / 2 - aoWidth / 2, Math.PI);
    addAo(W, -L / 2 + aoWidth / 2, 0, Math.PI / 2);
    addAo(W, L / 2 - aoWidth / 2, 0, -Math.PI / 2);

    // 6. Regulation 8-ball cloth markings: head string and head / centre / foot spots
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

      // Black steel leveller foot on each leg base
      const footPad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.085, 0.025, 20),
        new THREE.MeshStandardMaterial({ color: 0x1c1d21, metalness: 0.85, roughness: 0.35 })
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
    this.trajectoryLine = new THREE.Line(createDynamicLineGeometry(), lineMat);
    this.trajectoryLine.frustumCulled = false;
    this.scene.add(this.trajectoryLine);

    // 2. Deflected target ball line (luminous electric cyan)
    const targetLineMat = new THREE.LineDashedMaterial({
      color: 0x00f0ff,
      dashSize: 0.03,
      gapSize: 0.015,
    });
    this.targetBallLine = new THREE.Line(createDynamicLineGeometry(), targetLineMat);
    this.targetBallLine.frustumCulled = false;
    this.scene.add(this.targetBallLine);

    // 3. Cue ball deflection or cushion rebound line (warm gold)
    const reflectLineMat = new THREE.LineDashedMaterial({
      color: 0xfde047,
      dashSize: 0.025,
      gapSize: 0.015,
    });
    this.cueReflectLine = new THREE.Line(createDynamicLineGeometry(), reflectLineMat);
    this.cueReflectLine.frustumCulled = false;
    this.scene.add(this.cueReflectLine);

    // 4. Ghost ball sleek contact indicator (outer luminous ring + inner translucent disc + 3D holographic volume sphere)
    const ghostGroup = new THREE.Group();
    this.ghostBallGroup = ghostGroup;
    const R = TABLE_CONSTANTS.BALL_RADIUS;

    // Table footprint outer ring on felt
    const ringGeo = new THREE.RingGeometry(R * 0.90, R, 32);
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

    // 3D Holographic Cue Ball Sphere (eliminates perspective parallax against 3D spherical balls)
    const sphereGeo = new THREE.SphereGeometry(R, 32, 24);
    // Plain translucency: MeshPhysicalMaterial.transmission would force an extra full-scene render pass every frame
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.25,
      opacity: 0.38,
      transparent: true,
      roughness: 0.15,
      metalness: 0.05,
      depthWrite: false,
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.y = R;
    ghostGroup.add(sphereMesh);

    // 3D Equator latitude ring at ball center height
    const equatorGeo = new THREE.RingGeometry(R * 0.97, R * 1.01, 32);
    const equatorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const equatorMesh = new THREE.Mesh(equatorGeo, equatorMat);
    equatorMesh.rotation.x = -Math.PI / 2;
    equatorMesh.position.y = R;
    ghostGroup.add(equatorMesh);

    // Impact center point
    const centerGeo = new THREE.CircleGeometry(0.004, 16);
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

    _raycaster.setFromCamera(_ndc.set(ndcX, ndcY), this.camera);
    const hit = _raycaster.ray.intersectPlane(_tablePlane, _target);
    if (hit) {
      return { x: _target.x, z: _target.z };
    }
    return null;
  }

  /**
   * Synchronize 3D meshes with physics ball states.
   * When `prev` and `alpha` are given, positions are interpolated between the previous and the
   * latest fixed physics step so motion stays smooth when the display and physics rates differ.
   */
  public updateBalls(balls: BallPhysicsState[], prev?: BallPoseStore, alpha: number = 1) {
    const R = TABLE_CONSTANTS.BALL_RADIUS;

    if (!this.sharedBallGeometry) {
      // One shared 40x28 sphere: ~2.2k tris/ball instead of 6.1k, visually identical at ball size
      this.sharedBallGeometry = new THREE.SphereGeometry(R, 40, 28);
    }

    for (const b of balls) {
      let mesh = this.ballMeshes.get(b.id);

      if (!mesh) {
        const texture = createBallTexture(b.id);
        texture.anisotropy = this.maxAnisotropy;
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

        mesh = new THREE.Mesh(this.sharedBallGeometry, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.ballMeshes.set(b.id, mesh);
        this.shadowDirty = true;
      }

      if (b.state === 'pocketed') {
        if (mesh.visible) this.shadowDirty = true;
        mesh.visible = false;
        mesh.userData.lastPos = null;
        continue;
      }

      if (!mesh.visible) this.shadowDirty = true;
      mesh.visible = true;

      let px = b.position.x;
      let pz = b.position.z;
      let ph = b.height;
      const before = prev?.get(b.id);
      if (before && alpha < 1) {
        px = before.x + (px - before.x) * alpha;
        pz = before.z + (pz - before.z) * alpha;
        ph = before.h + (ph - before.h) * alpha;
      }
      mesh.position.set(px, R + ph, pz);

      // 1:1 Physical rolling rotation strictly coupled to surface displacement
      const lastPos = mesh.userData.lastPos as { x: number; z: number } | undefined;
      const now = performance.now();
      const lastTime = (mesh.userData.lastTime as number) || now;
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0.005), 0.033);

      if (lastPos) {
        const dx = px - lastPos.x;
        const dz = pz - lastPos.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.00001) {
          this.shadowDirty = true;
          // Authentic no-slip rolling: axis (dz / dist, 0, -dx / dist), angle dist / R
          _axis.set(dz / dist, 0, -dx / dist);
          _quat.setFromAxisAngle(_axis, dist / R);
          mesh.quaternion.premultiply(_quat);
        }
      }

      // Apply physical sliding slip (backspin/topspin differential while sliding)
      if (b.state === 'sliding') {
        const wxSlip = b.angularVelocity.x - (b.velocity.z / R);
        const wzSlip = b.angularVelocity.z - (-b.velocity.x / R);
        const slipSpeed = Math.hypot(wxSlip, wzSlip);
        if (slipSpeed > 0.05) {
          _axis.set(wxSlip / slipSpeed, 0, wzSlip / slipSpeed);
          _quat.setFromAxisAngle(_axis, slipSpeed * dt);
          mesh.quaternion.premultiply(_quat);
        }
      }

      // Apply vertical English spin around Y axis
      if (Math.abs(b.angularVelocity.y) > 0.01) {
        _axis.set(0, 1, 0);
        _quat.setFromAxisAngle(_axis, b.angularVelocity.y * dt);
        mesh.quaternion.premultiply(_quat);
      }

      mesh.userData.lastPos = { x: px, z: pz };
      mesh.userData.lastTime = now;
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
      setLineEndpoints(
        this.trajectoryLine,
        traj.cueStart.x, yGuideline, traj.cueStart.z,
        traj.cueHitPoint.x, yGuideline, traj.cueHitPoint.z
      );

      const cueMat = this.trajectoryLine.material as THREE.LineDashedMaterial;
      if (traj.cueWillPocket) {
        cueMat.color.setHex(0xf43f5e); // Soft warning rose red if cue ball is heading directly into pocket
      } else {
        cueMat.color.setHex(0xffffff); // Laser white
      }
    }

    // 2. 3D Ghost ball indicator at point of impact
    if (this.ghostBallGroup && traj.targetBallId !== undefined) {
      this.ghostBallGroup.visible = true;
      this.ghostBallGroup.position.set(traj.cueHitPoint.x, 0, traj.cueHitPoint.z);
    } else if (this.ghostBallGroup) {
      this.ghostBallGroup.visible = false;
    }

    // 3. Full-length target ball deflected path (emerald green when pocket-bound, electric cyan otherwise)
    if (this.targetBallLine && traj.targetBallStart && (traj.targetBallEnd || traj.targetBallDir)) {
      this.targetBallLine.visible = true;
      const endX = traj.targetBallEnd ? traj.targetBallEnd.x : traj.targetBallStart.x + traj.targetBallDir!.x * 0.8;
      const endZ = traj.targetBallEnd ? traj.targetBallEnd.z : traj.targetBallStart.z + traj.targetBallDir!.z * 0.8;

      setLineEndpoints(
        this.targetBallLine,
        traj.targetBallStart.x, yGuideline, traj.targetBallStart.z,
        endX, yGuideline, endZ
      );

      const targetMat = this.targetBallLine.material as THREE.LineDashedMaterial;
      if (traj.targetBallWillPocket) {
        targetMat.color.setHex(0x10b981); // Radiant emerald green on pocket target!
        targetMat.dashSize = 0.035;
        targetMat.gapSize = 0.015;
      } else {
        targetMat.color.setHex(0x00f0ff); // Electric cyan towards cushion or obstacle
        targetMat.dashSize = 0.030;
        targetMat.gapSize = 0.020;
      }
    } else if (this.targetBallLine) {
      this.targetBallLine.visible = false;
    }

    // 4. Cue ball deflection or cushion rebound path (warm gold)
    const reflectDir = traj.cueReflectDir || traj.cushionReflectDir;
    if (this.cueReflectLine && reflectDir) {
      this.cueReflectLine.visible = true;
      const reflectLen = 0.40;
      setLineEndpoints(
        this.cueReflectLine,
        traj.cueHitPoint.x, yGuideline, traj.cueHitPoint.z,
        traj.cueHitPoint.x + reflectDir.x * reflectLen, yGuideline, traj.cueHitPoint.z + reflectDir.z * reflectLen
      );
    } else if (this.cueReflectLine) {
      this.cueReflectLine.visible = false;
    }
  }

  private adjustCameraFov() {
    if (!this.camera) return;
    const aspect = this.camera.aspect;
    // Base desktop fov is 45deg for aspect >= 1.33
    // On mobile portrait (aspect < 1.33), increase vertical FOV smoothly to maintain comfortable horizontal framing
    if (aspect < 1.33) {
      const targetFov = 2 * Math.atan(Math.tan((45 * Math.PI) / 360) * (1.33 / Math.max(0.55, aspect))) * (180 / Math.PI);
      this.camera.fov = Math.min(75, Math.max(45, targetFov));
    } else {
      this.camera.fov = 45;
    }
  }

  /**
   * Set dynamic camera positioning
   */
  public updateCamera(cueBall?: BallPhysicsState, aimAngle: number = 0, isBallInHand: boolean = false) {
    const aspect = this.camera.aspect;
    const isPortrait = aspect < 1.0;

    if (this.lampFixture) this.lampFixture.visible = this.cameraMode !== 'overhead';

    if (this.cameraMode === 'overhead') {
      // Tactical top-down view: in portrait, scale height so entire table length fits on screen
      const baseHeight = 3.2;
      const height = isPortrait ? Math.max(baseHeight, 1.85 / Math.max(0.45, aspect)) : baseHeight;
      this.targetCameraPos.set(0, height, 0);
      this.targetCameraLookAt.set(0, 0, 0);
    } else if (isBallInHand) {
      // Elevated perspective view for intuitive ball placement across entire table
      const scale = isPortrait ? Math.max(1, 0.85 / Math.max(0.45, aspect)) : 1;
      this.targetCameraPos.set(0, 2.3 * scale, 1.75 * scale);
      this.targetCameraLookAt.set(0, 0, 0);
    } else if (cueBall) {
      // Over-the-shoulder cue aiming view
      const distScale = isPortrait ? Math.min(1.3, 0.9 / Math.max(0.55, aspect)) : 1.0;
      const camDist = 1.35 * distScale;
      const camHeight = 0.65 * distScale;
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
    this.camera.position.lerp(this.targetCameraPos, this.cameraLerp);
    this.camera.lookAt(this.targetCameraLookAt);
  }

  private onResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.adjustCameraFov();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.shadowDirty = true;
  };

  /** Ask for the shadow map to be re-rendered on the next frame (it is otherwise frozen). */
  public markShadowsDirty() {
    this.shadowDirty = true;
  }

  /** Raise anisotropic filtering on every textured table/room material so the felt stays sharp at grazing angles. */
  private applyTextureQuality() {
    this.maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const seen = new Set<THREE.Texture>();
    this.scene.traverse(obj => {
      const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        const std = m as THREE.MeshStandardMaterial;
        for (const tex of [std.map, std.bumpMap, std.emissiveMap, std.roughnessMap, std.normalMap]) {
          if (tex && !seen.has(tex)) {
            seen.add(tex);
            tex.anisotropy = this.maxAnisotropy;
            tex.needsUpdate = true;
          }
        }
      }
    });
  }

  /**
   * Pick the highest pixel ratio the GPU can sustain. Drops quickly when frames run long,
   * and cautiously climbs back up (never to a level that recently failed).
   */
  private adaptResolution(frameMs: number, nowMs: number) {
    if (document.hidden || frameMs > 250) return; // tab switch / debugger pause, not a real signal
    this.perfFrames++;
    this.perfTimeMs += frameMs;
    if (this.perfFrames < 20) return;

    const avg = this.perfTimeMs / this.perfFrames;
    this.perfFrames = 0;
    this.perfTimeMs = 0;

    const MIN_RATIO = 0.75;
    if (avg > 21 && this.pixelRatio > MIN_RATIO) {
      this.bannedRatio = this.pixelRatio;
      this.bannedUntil = nowMs + 30000;
      this.stableMs = 0;
      this.setPixelRatio(Math.max(MIN_RATIO, this.pixelRatio * (avg > 32 ? 0.75 : 0.88)));
    } else if (avg <= 18.5) {
      this.stableMs += avg * 20;
      const next = Math.min(this.maxPixelRatio, this.pixelRatio * 1.15);
      const banned = nowMs < this.bannedUntil && next >= this.bannedRatio * 0.97;
      if (this.stableMs > 4000 && this.pixelRatio < this.maxPixelRatio && !banned) {
        this.stableMs = 0;
        this.setPixelRatio(next);
      }
    } else {
      this.stableMs = 0;
    }
  }

  private setPixelRatio(ratio: number) {
    this.pixelRatio = Math.round(ratio * 100) / 100;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.shadowDirty = true;
  }

  private startRenderLoop() {
    const loop = (ts: number) => {
      this.animationFrameId = requestAnimationFrame(loop);

      const frameMs = this.lastFrameTs ? ts - this.lastFrameTs : 16.7;
      this.lastFrameTs = ts;
      // Frame-rate independent camera smoothing (matches the old 0.08/frame at 60fps)
      this.cameraLerp = 1 - Math.pow(1 - 0.08, Math.min(frameMs, 100) / 16.667);
      this.adaptResolution(frameMs, ts);

      this.onFrame?.(ts);

      if (this.shadowDirty) {
        this.renderer.shadowMap.needsUpdate = true;
        this.shadowDirty = false;
      }
      this.renderer.render(this.scene, this.camera);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.onFrame = null;
    window.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);

    // Release GPU memory so repeated games / page visits don't accumulate textures and geometry
    const textures = new Set<THREE.Texture>();
    this.scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        for (const value of Object.values(m)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
        m.dispose();
      }
    });
    textures.forEach(t => t.dispose());
    (this.scene.environment as THREE.Texture | null)?.dispose();

    this.vignette?.remove();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}

// Scratch objects reused every frame to avoid per-frame garbage
const _axis = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _target = new THREE.Vector3();

/** Previous-step pose of each ball, used for render interpolation. */
export type BallPoseStore = Map<number, { x: number; z: number; h: number }>;

/** Copy the current ball poses into `store`, reusing its entries. Call before each physics step. */
export function captureBallPoses(balls: BallPhysicsState[], store: BallPoseStore) {
  for (const b of balls) {
    const e = store.get(b.id);
    if (e) {
      e.x = b.position.x;
      e.z = b.position.z;
      e.h = b.height;
    } else {
      store.set(b.id, { x: b.position.x, z: b.position.z, h: b.height });
    }
  }
}

/** Line with a fixed two-vertex position + lineDistance buffer that is updated in place. */
function createDynamicLineGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(6), 3);
  const dist = new THREE.BufferAttribute(new Float32Array(2), 1);
  pos.setUsage(THREE.DynamicDrawUsage);
  dist.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pos);
  geo.setAttribute('lineDistance', dist);
  return geo;
}

function setLineEndpoints(
  line: THREE.Line,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number
) {
  const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
  const dist = line.geometry.getAttribute('lineDistance') as THREE.BufferAttribute;
  pos.setXYZ(0, ax, ay, az);
  pos.setXYZ(1, bx, by, bz);
  dist.setX(0, 0);
  dist.setX(1, Math.hypot(bx - ax, by - ay, bz - az));
  pos.needsUpdate = true;
  dist.needsUpdate = true;
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
