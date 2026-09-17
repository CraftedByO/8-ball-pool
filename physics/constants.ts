// Billiards Physical Constants & Table Geometry
// Units are in SI meters, kilograms, seconds

export const TABLE_CONSTANTS = {
  // Regulation 9-foot pool table playing surface dimensions (2:1 ratio)
  // Length along X-axis: 2.54m (100 inches)
  // Width along Z-axis: 1.27m (50 inches)
  TABLE_LENGTH: 2.54,
  TABLE_WIDTH: 1.27,
  PLAYFIELD_MIN_X: -1.27,
  PLAYFIELD_MAX_X: 1.27,
  PLAYFIELD_MIN_Z: -0.635,
  PLAYFIELD_MAX_Z: 0.635,

  // Table height from floor
  TABLE_HEIGHT: 0.80,

  // Ball properties
  BALL_RADIUS: 0.028575, // Standard 2.25 inch diameter = 57.15mm -> radius = 28.575mm = 0.028575m
  BALL_DIAMETER: 0.05715,
  BALL_MASS: 0.170, // 170 grams (standard regulation 160-170g)
  MOMENT_OF_INERTIA: (2 / 5) * 0.170 * (0.028575 ** 2), // Sphere I = 2/5 * m * R^2

  // Pocket geometry
  // 6 pockets: 4 corner pockets, 2 side/middle pockets
  CORNER_POCKET_RADIUS: 0.075, // Mouth opening ~150mm
  SIDE_POCKET_RADIUS: 0.080, // Side pockets mouth opening ~160mm
  POCKET_CAPTURE_RADIUS: 0.075, // Radius threshold from pocket center where ball drops
  POCKET_DEPTH: 0.05,

  // Physics simulation coefficients
  GRAVITY: 9.81,
  SLIDING_FRICTION_COEFF: 0.22, // Simonis worsted cloth sliding friction (mu_s)
  ROLLING_RESISTANCE_COEFF: 0.040, // Realistic tournament cloth rolling resistance (mu_r)
  SPIN_DECELERATION_COEFF: 12.0, // Angular velocity damping around vertical axis
  BALL_RESTITUTION: 0.92, // Phenolic resin ball restitution (Aramith tournament balls)
  CUSHION_RESTITUTION: 0.70, // Energy retained when rebounding off rubber rail
  CUSHION_FRICTION: 0.18, // Cushion tangential friction influencing spin conversion

  // Fixed simulation sub-step timestep (e.g. 120Hz = ~0.00833s)
  FIXED_TIMESTEP: 1 / 120,
  VELOCITY_EPSILON: 0.025, // Velocity below which ball comes to a clean, crisp stop (~2.5 cm/s)
  ANGULAR_EPSILON: 0.10,
};

export interface Vector2D {
  x: number;
  z: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface PocketDef {
  id: string;
  position: Vector2D;
  radius: number;
  captureRadius: number;
  isSide: boolean;
}

export const POCKETS: PocketDef[] = [
  // Top-left corner
  {
    id: 'pocket_corner_tl',
    position: { x: TABLE_CONSTANTS.PLAYFIELD_MIN_X, z: TABLE_CONSTANTS.PLAYFIELD_MIN_Z },
    radius: TABLE_CONSTANTS.CORNER_POCKET_RADIUS,
    captureRadius: TABLE_CONSTANTS.CORNER_POCKET_RADIUS,
    isSide: false,
  },
  // Top-center side
  {
    id: 'pocket_side_t',
    position: { x: 0, z: TABLE_CONSTANTS.PLAYFIELD_MIN_Z },
    radius: TABLE_CONSTANTS.SIDE_POCKET_RADIUS,
    captureRadius: TABLE_CONSTANTS.SIDE_POCKET_RADIUS,
    isSide: true,
  },
  // Top-right corner
  {
    id: 'pocket_corner_tr',
    position: { x: TABLE_CONSTANTS.PLAYFIELD_MAX_X, z: TABLE_CONSTANTS.PLAYFIELD_MIN_Z },
    radius: TABLE_CONSTANTS.CORNER_POCKET_RADIUS,
    captureRadius: TABLE_CONSTANTS.CORNER_POCKET_RADIUS,
    isSide: false,
  },
  // Bottom-left corner
  {
    id: 'pocket_corner_bl',
    position: { x: TABLE_CONSTANTS.PLAYFIELD_MIN_X, z: TABLE_CONSTANTS.PLAYFIELD_MAX_Z },
    radius: TABLE_CONSTANTS.CORNER_POCKET_RADIUS,
    captureRadius: TABLE_CONSTANTS.CORNER_POCKET_RADIUS,
    isSide: false,
  },
  // Bottom-center side
  {
    id: 'pocket_side_b',
    position: { x: 0, z: TABLE_CONSTANTS.PLAYFIELD_MAX_Z },
    radius: TABLE_CONSTANTS.SIDE_POCKET_RADIUS,
    captureRadius: TABLE_CONSTANTS.SIDE_POCKET_RADIUS,
    isSide: true,
  },
  // Bottom-right corner
  {
    id: 'pocket_corner_br',
    position: { x: TABLE_CONSTANTS.PLAYFIELD_MAX_X, z: TABLE_CONSTANTS.PLAYFIELD_MAX_Z },
    radius: TABLE_CONSTANTS.CORNER_POCKET_RADIUS,
    captureRadius: TABLE_CONSTANTS.CORNER_POCKET_RADIUS,
    isSide: false,
  },
];

export interface CushionSegment {
  id: string;
  start: Vector2D;
  end: Vector2D;
  normal: Vector2D; // Inward facing normal
}

const marginX = 0.065;
const sideMarginX = 0.065;
const marginZ = 0.065;

export const CUSHION_SEGMENTS: CushionSegment[] = [
  // Top-Left rail
  {
    id: 'rail_top_left',
    start: { x: TABLE_CONSTANTS.PLAYFIELD_MIN_X + marginX, z: TABLE_CONSTANTS.PLAYFIELD_MIN_Z },
    end: { x: -sideMarginX, z: TABLE_CONSTANTS.PLAYFIELD_MIN_Z },
    normal: { x: 0, z: 1 },
  },
  // Top-Right rail
  {
    id: 'rail_top_right',
    start: { x: sideMarginX, z: TABLE_CONSTANTS.PLAYFIELD_MIN_Z },
    end: { x: TABLE_CONSTANTS.PLAYFIELD_MAX_X - marginX, z: TABLE_CONSTANTS.PLAYFIELD_MIN_Z },
    normal: { x: 0, z: 1 },
  },
  // Bottom-Left rail
  {
    id: 'rail_bottom_left',
    start: { x: TABLE_CONSTANTS.PLAYFIELD_MIN_X + marginX, z: TABLE_CONSTANTS.PLAYFIELD_MAX_Z },
    end: { x: -sideMarginX, z: TABLE_CONSTANTS.PLAYFIELD_MAX_Z },
    normal: { x: 0, z: -1 },
  },
  // Bottom-Right rail
  {
    id: 'rail_bottom_right',
    start: { x: sideMarginX, z: TABLE_CONSTANTS.PLAYFIELD_MAX_Z },
    end: { x: TABLE_CONSTANTS.PLAYFIELD_MAX_X - marginX, z: TABLE_CONSTANTS.PLAYFIELD_MAX_Z },
    normal: { x: 0, z: -1 },
  },
  // Left rail
  {
    id: 'rail_left',
    start: { x: TABLE_CONSTANTS.PLAYFIELD_MIN_X, z: TABLE_CONSTANTS.PLAYFIELD_MIN_Z + marginZ },
    end: { x: TABLE_CONSTANTS.PLAYFIELD_MIN_X, z: TABLE_CONSTANTS.PLAYFIELD_MAX_Z - marginZ },
    normal: { x: 1, z: 0 },
  },
  // Right rail
  {
    id: 'rail_right',
    start: { x: TABLE_CONSTANTS.PLAYFIELD_MAX_X, z: TABLE_CONSTANTS.PLAYFIELD_MIN_Z + marginZ },
    end: { x: TABLE_CONSTANTS.PLAYFIELD_MAX_X, z: TABLE_CONSTANTS.PLAYFIELD_MAX_Z - marginZ },
    normal: { x: -1, z: 0 },
  },
];
