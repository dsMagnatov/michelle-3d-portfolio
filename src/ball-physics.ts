export interface Platform {
  x: number;
  y: number;
  halfWidth: number;
  angle: number;
}

export interface SoftBall {
  x: number; y: number; vx: number; vy: number;
  radius: number; spin: number; omega: number;
  squash: number; squashVelocity: number;
  grounded: boolean; bounces: number; recycles: number;
}

const GRAVITY = 1850;
const SPAWNS = [0.14, 0.40, 0.74];
const RADII = [67, 72, 65];
const limit = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Fixed-step circle contacts, rolling and a damped spring for soft leather deformation. */
export class SoftBallWorld {
  balls: SoftBall[] = [];
  width = 1920;
  height = 1080;
  platform: Platform = { x: 960, y: 832, halfWidth: 875, angle: 0 };
  private platformVX = 0;
  private platformVY = 0;
  private platformOmega = 0;
  private floorMode = false;

  reset(width: number, height: number, platform: Platform) {
    this.floorMode = false;
    this.width = width; this.height = height;
    this.platform = { ...platform };
    this.platformVX = this.platformVY = this.platformOmega = 0;
    const c = Math.cos(platform.angle), s = Math.sin(platform.angle);
    const spawns = platform.halfWidth < 260 ? [0.1, 0.5, 0.9] : SPAWNS;
    this.balls = RADII.map((radius, i) => {
      const t = (spawns[i] * 2 - 1) * platform.halfWidth;
      return {
        x: platform.x + t * c + s * radius * 0.96,
        y: platform.y + t * s - c * radius * 0.96,
        vx: 0, vy: 0, radius, spin: 0, omega: 0,
        squash: 0.04, squashVelocity: 0,
        grounded: true, bounces: 0, recycles: 0,
      };
    });
  }

  resetFloor(width: number, height: number, floorY: number, staticPose = false) {
    this.reset(width, height, { x: width / 2, y: floorY, halfWidth: width / 2, angle: 0 });
    this.floorMode = true;
    const positions = [0.2, 0.5, 0.8];
    this.balls.forEach((ball, i) => {
      ball.x = positions[i] * width;
      ball.y = staticPose ? floorY - ball.radius * 0.96 : -ball.radius * (2 + i * 2.1);
      ball.vx = staticPose ? 0 : [95, -55, -85][i];
      ball.vy = 0;
      ball.grounded = staticPose;
      ball.squash = staticPose ? 0.04 : 0;
    });
  }

  resizeFloor(width: number, height: number, floorY: number) {
    const sx = width / this.width, sy = height / this.height;
    this.balls.forEach(ball => {
      ball.x = limit(ball.x * sx, ball.radius, width - ball.radius);
      ball.y = floorY - (this.platform.y - ball.y) * sy;
      ball.vx *= sx; ball.vy *= sy;
      if (ball.grounded) ball.y = floorY - ball.radius * (1 - ball.squash);
    });
    this.width = width; this.height = height;
    this.platform = { x: width / 2, y: floorY, halfWidth: width / 2, angle: 0 };
    this.platformVX = this.platformVY = this.platformOmega = 0;
  }

  setPlatform(platform: Platform, elapsed: number) {
    const dt = Math.max(elapsed, 1 / 120);
    this.platformVX = limit((platform.x - this.platform.x) / dt, -900, 900);
    this.platformVY = limit((platform.y - this.platform.y) / dt, -900, 900);
    this.platformOmega = limit((platform.angle - this.platform.angle) / dt, -1, 1);
    this.platform = { ...platform };
  }

  step(dt: number) {
    const p = this.platform;
    const c = Math.cos(p.angle), s = Math.sin(p.angle);
    const nx = s, ny = -c;
    for (const ball of this.balls) {
      const previousDistance = (ball.x - p.x) * nx + (ball.y - p.y) * ny;
      ball.vy += GRAVITY * dt;
      ball.vx *= Math.exp(-0.07 * dt);
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.grounded = false;
      const t = (ball.x - p.x) * c + (ball.y - p.y) * s;
      const distance = (ball.x - p.x) * nx + (ball.y - p.y) * ny;
      const radius = ball.radius * (1 - ball.squash);
      // One-way contact: after rolling off an edge, the ball can fall behind the text.
      if (Math.abs(t) <= p.halfWidth && distance < radius && previousDistance > -ball.radius * 0.6) {
        const surfaceVX = this.platformVX - this.platformOmega * t * s;
        const surfaceVY = this.platformVY + this.platformOmega * t * c;
        const vn = (ball.vx - surfaceVX) * nx + (ball.vy - surfaceVY) * ny;
        ball.x += nx * (radius - distance);
        ball.y += ny * (radius - distance);
        if (vn < 0) {
          const impact = -vn;
          const rebound = impact > 85 ? 0.32 : 0;
          ball.vx -= (1 + rebound) * vn * nx;
          ball.vy -= (1 + rebound) * vn * ny;
          if (impact > 85) {
            ball.bounces++;
            ball.squashVelocity += Math.min(4.4, impact / ball.radius * 0.24);
          }
        }
        const tangentVelocity = ball.vx * c + ball.vy * s;
        const rollingLoss = tangentVelocity * (1 - Math.exp(-(this.floorMode ? 2.8 : 0.11) * dt));
        ball.vx -= c * rollingLoss;
        ball.vy -= s * rollingLoss;
        ball.omega = tangentVelocity / ball.radius;
        ball.grounded = true;
      }
      ball.spin += ball.omega * dt;
      const targetSquash = ball.grounded ? 0.04 : 0;
      ball.squashVelocity += ((targetSquash - ball.squash) * 175 - ball.squashVelocity * 17) * dt;
      ball.squash = limit(ball.squash + ball.squashVelocity * dt, -0.045, 0.26);
      if (ball.squash >= 0.26) ball.squashVelocity = Math.min(0, ball.squashVelocity);
      if (this.floorMode) {
        if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx) * 0.3; }
        if (ball.x > this.width - ball.radius) { ball.x = this.width - ball.radius; ball.vx = -Math.abs(ball.vx) * 0.3; }
      } else if (ball.y - ball.radius > this.height + ball.radius) this.respawn(ball, this.balls.indexOf(ball));
    }
    // The three padded balls also collide with each other.
    for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
      const a = this.balls[i], b = this.balls[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const radius = a.radius + b.radius;
      if (distance >= radius || distance < 0.001) continue;
      const nx = dx / distance, ny = dy / distance;
      const overlap = (radius - distance) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap;
      b.x += nx * overlap; b.y += ny * overlap;
      const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closing < 0) {
        const impulse = -closing * 0.65;
        a.vx -= nx * impulse; a.vy -= ny * impulse;
        b.vx += nx * impulse; b.vy += ny * impulse;
        a.squashVelocity += Math.min(1.5, -closing / a.radius * 0.08);
        b.squashVelocity += Math.min(1.5, -closing / b.radius * 0.08);
      }
    }
  }

  private respawn(ball: SoftBall, index: number) {
    const p = this.platform;
    ball.x = limit(p.x + (SPAWNS[index] * 2 - 1) * p.halfWidth, ball.radius, this.width - ball.radius);
    ball.y = -ball.radius * (2 + index * 0.65);
    ball.vx = (index - 1) * 8;
    ball.vy = 35;
    ball.squash = ball.squashVelocity = 0;
    ball.grounded = false;
    ball.recycles++;
  }

  get moving() {
    return Math.abs(this.platform.angle) > 0.0001 || this.balls.some((ball, index) =>
      !ball.grounded || Math.hypot(ball.vx, ball.vy) > 0.4 || Math.abs(ball.squashVelocity) > 0.002
      || this.balls.slice(index + 1).some(other =>
        Math.hypot(ball.x - other.x, ball.y - other.y) < ball.radius + other.radius - 0.5));
  }
}
