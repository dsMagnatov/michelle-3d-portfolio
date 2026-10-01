import assert from 'node:assert/strict';
import { SoftBallWorld } from '../src/ball-physics.ts';

const world = new SoftBallWorld();
const flat = { x: 995, y: 832, halfWidth: 872, angle: 0 };
const step = 1 / 120;
world.reset(1920, 1080, flat);
const initial = world.balls.map(ball => ball.x);
for (let i = 0; i < 1200; i++) { world.setPlatform(flat, step); world.step(step); }
world.balls.forEach((ball, i) => {
  assert(Math.abs(ball.x - initial[i]) < 1, 'A resting ball should not drift on a flat caption.');
  assert(ball.grounded, 'A resting ball must remain on the caption.');
});
const tilted = { ...flat, angle: 0.035 };
let peakSquash = 0;
for (let i = 0; i < 120 * 32; i++) {
  world.setPlatform(tilted, step); world.step(step);
  for (const ball of world.balls) {
    assert([ball.x, ball.y, ball.vx, ball.vy, ball.squash].every(Number.isFinite), 'Finite physics state.');
    peakSquash = Math.max(peakSquash, ball.squash);
  }
}
assert(world.balls.every(ball => ball.recycles > 0), 'Every ball must roll off and return from above.');
assert(world.balls.some(ball => ball.bounces > 0), 'Returned balls must land and rebound.');
assert(peakSquash > 0.1 && peakSquash <= 0.26, 'Landings must visibly compress without collapsing the ball.');
const firstFall = angle => {
  const trial = new SoftBallWorld();
  const platform = { ...flat, angle };
  trial.reset(1920, 1080, platform);
  for (let frame = 0; frame < 120 * 20; frame++) {
    trial.setPlatform(platform, step); trial.step(step);
    if (trial.balls.some(ball => ball.recycles > 0)) return frame * step;
  }
  return Infinity;
};
assert(firstFall(0.105) < firstFall(0.035) * 0.8, 'The steeper caption must send balls off visibly sooner.');
assert(Number.isFinite(firstFall(-0.105)), 'The increased tilt must work in both directions.');
const floor = new SoftBallWorld();
floor.resetFloor(1920, 1080, 1008);
assert(floor.balls.every(ball => ball.y < 0 && !ball.grounded), 'Contact balls start above the screen.');
let floorCompression = 0;
for (let i = 0; i < 120 * 15; i++) {
  floor.step(step);
  for (const ball of floor.balls) {
    assert([ball.x, ball.y, ball.vx, ball.vy, ball.squash].every(Number.isFinite), 'Finite contact physics.');
    assert(ball.x >= ball.radius && ball.x <= floor.width - ball.radius, 'Footer side boundaries contain the balls.');
    floorCompression = Math.max(floorCompression, ball.squash);
  }
}
assert(floor.balls.every(ball => ball.grounded && ball.recycles === 0), 'Footer balls stay on the floor without recycling.');
assert(floor.balls.every(ball => Math.hypot(ball.vx, ball.vy) < 0.4), 'Footer balls stop rolling.');
assert(!floor.moving, 'The footer simulation sleeps after settling.');
assert(floorCompression > 0.1 && floorCompression <= 0.26, 'Footer landings squash softly.');
floor.resizeFloor(1920, 1337, 1265);
assert(floor.balls.every(ball => Math.abs(ball.y + ball.radius * (1 - ball.squash) - 1265) < 0.01), 'Footer resize keeps settled balls on the floor.');
floor.resetFloor(1920, 1080, 1008, true);
assert(!floor.moving && floor.balls.every(ball => ball.grounded), 'Reduced motion uses a resting footer pose.');
world.reset(1920, 1337, { ...flat, y: 1087 });
assert(world.balls.every(ball => ball.grounded && ball.y < 1087), 'Resize must put balls onto the relocated caption.');
world.reset(720, 1558, { x: 360, y: 1270, halfWidth: 195, angle: 0 });
world.balls[1].x = world.balls[0].x + Math.sign(world.balls[1].x - world.balls[0].x) * 110;
assert(world.moving, 'Overlapping balls must keep the solver awake.');
for (let i = 0; i < 120 * 10 && world.moving; i++) world.step(step);
assert(!world.moving && world.balls.every(ball => ball.grounded && ball.recycles === 0), 'Mobile caption settles without dropping balls.');
for (let i = 1; i < world.balls.length; i++) {
  const a = world.balls[i - 1], b = world.balls[i];
  assert(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - 0.5, 'Mobile balls must not sleep while overlapping.');
}
console.log('Physics passed: caption tilt/recycling, soft rebounds, footer settling, resize, reduced motion, mobile caption contacts.');
