export const clamp = (x: number) => Math.max(0, Math.min(1, x));
export const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
export const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const START = { x: 0, y: 4, z: 14, fov: 44 };
export const PORTFOLIO_WALL = { z: -52, height: 7.2, y: 4 };
export const END_Z = PORTFOLIO_WALL.z + PORTFOLIO_WALL.height / (2 * Math.tan(START.fov * Math.PI / 360));

/** Only the camera moves. The painted architecture and its typography stay fixed. */
export function choreography(progress: number, fov: number = START.fov) {
  const travel = smooth(range(progress, 0.16, 0.985));
  const turn = smooth(range(progress, 0.16, 0.52));
  const endZ = PORTFOLIO_WALL.z + PORTFOLIO_WALL.height / (2 * Math.tan(fov * Math.PI / 360));
  return {
    cameraX: Math.sin(travel * Math.PI) * 0.75,
    cameraY: START.y - 0.15 * Math.sin(travel * Math.PI),
    cameraZ: mix(START.z, endZ, travel),
    yaw: 0.035 * Math.sin(turn * Math.PI),
    architecture: smooth(range(progress, 0.16, 0.45)),
    paint: progress >= 0.12,
  };
}
