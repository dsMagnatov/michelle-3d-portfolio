import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SoftBallWorld, type Platform, type SoftBall } from './ball-physics';
import type { CompositionLayout } from './layout';
import { range, smooth } from './motion';

const ASSETS = ['ball-x.glb', 'ball-pinterest.glb', 'ball-behance.glb'];
const NETWORKS = ['X / Twitter', 'Pinterest', 'Behance'];
const STEP = 1 / 120;

export class SocialBalls {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-960, 960, 540, -540, 1, 6000);
  private world = new SoftBallWorld();
  private objects: THREE.Group[] = [];
  private spins: THREE.Group[] = [];
  private shadows: THREE.Sprite[] = [];
  private line = { x: 0, y: 0, halfWidth: 0, localX: 0, localY: 0 };
  private motion = { angle: 0, x: 0, y: 0 };
  private visible = true;
  private reduced = false;
  private exit = 0;
  private disposed = false;
  private frame = 0;
  private lastTime = 0;
  private accumulator = 0;
  private diagnosticTime = 0;
  private shadowTexture: THREE.CanvasTexture;
  private homeContainer: HTMLElement;
  private contactMode = false;
  private savedFloor: { width: number; height: number; floorY: number; balls: SoftBall[] } | undefined;
  private hover = document.createElement('div');
  private pointer: { x: number; y: number } | undefined;
  private hovered = -1;
  private touchPointer = false;

  constructor(private container: HTMLElement, private footer: HTMLElement, private layout: CompositionLayout) {
    this.homeContainer = container;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0xffffff, 0);
    this.camera.position.z = 3000;
    container.append(this.renderer.domElement);
    this.hover.className = 'ball-hover';
    this.hover.innerHTML = '<span class="ball-hover-pill">OPEN LINK <span class="ball-hover-arrow">↗</span></span>';
    this.hover.setAttribute('aria-hidden', 'true');
    container.append(this.hover);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0,0,0,.24)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    this.shadowTexture = new THREE.CanvasTexture(canvas);
    this.resize(layout);
    document.addEventListener('visibilitychange', this.visibilityChange);
    window.addEventListener('pointermove', this.pointerMove);
    window.addEventListener('pointerdown', this.pointerDown);
    window.addEventListener('scroll', this.scrollHover, { passive: true });
    window.addEventListener('blur', this.clearHover);
    document.documentElement.addEventListener('pointerleave', this.clearHover);
  }

  async load() {
    const loader = new GLTFLoader();
    const models = await Promise.all(ASSETS.map(asset => loader.loadAsync(`/${asset}`)));
    models.forEach((gltf, index) => {
      const root = gltf.scene;
      if (this.disposed) { this.disposeModel(root); return; }
      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      root.position.copy(center).negate();
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const source = object.material as THREE.MeshStandardMaterial;
        object.material = new THREE.MeshBasicMaterial({ map: source.map, color: source.color });
        source.dispose();
      });
      const spin = new THREE.Group(); spin.add(root);
      spin.scale.setScalar(this.world.balls[index].radius * 2 / Math.max(size.x, size.y));
      const object = new THREE.Group(); object.add(spin);
      this.spins.push(spin); this.objects.push(object); this.scene.add(object);
      const shadow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.shadowTexture, transparent: true, depthWrite: false }));
      this.shadows.push(shadow); this.scene.add(shadow);
    });
    if (this.disposed) return;
    this.container.dataset.loaded = '3';
    this.render();
    this.wake();
  }

  resize(layout: CompositionLayout) {
    this.layout = layout;
    this.motion = { angle: 0, x: 0, y: 0 };
    this.camera.left = -layout.logicalWidth / 2; this.camera.right = layout.logicalWidth / 2;
    this.camera.top = layout.logicalHeight / 2; this.camera.bottom = -layout.logicalHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, layout.mobile ? 1.5 : 2));
    this.renderer.setSize(Math.round(layout.width), Math.round(layout.height), false);
    // Measure glyphs in their untransformed coordinate system, not a rotated DOM bounding box.
    const surface = this.footer.querySelector<HTMLElement>('.title-line') ?? this.footer;
    const style = getComputedStyle(surface);
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = ctx.measureText(surface.textContent!.trim());
    const baseline = (surface.offsetHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
      + metrics.fontBoundingBoxAscent;
    const inkLeft = -metrics.actualBoundingBoxLeft, inkRight = metrics.actualBoundingBoxRight;
    this.line = {
      x: this.footer.offsetLeft + this.footer.offsetWidth / 2,
      y: this.footer.offsetTop + this.footer.offsetHeight / 2,
      halfWidth: (inkRight - inkLeft) / 2,
      localX: surface.offsetLeft + (inkLeft + inkRight - this.footer.offsetWidth) / 2,
      localY: surface.offsetTop + baseline - metrics.actualBoundingBoxAscent - this.footer.offsetHeight / 2,
    };
    if (this.contactMode) this.world.resizeFloor(layout.logicalWidth, layout.logicalHeight, layout.logicalHeight - 72);
    else this.world.reset(layout.logicalWidth, layout.logicalHeight, this.platform());
    this.accumulator = 0; this.lastTime = 0;
    this.render(); this.wake();
  }

  setMotion(angle: number, x: number, y: number, visible: boolean, reduced: boolean, exit = 0) {
    if (this.contactMode) return;
    const returning = visible && !this.visible;
    const changedPreference = reduced !== this.reduced;
    this.visible = visible; this.reduced = reduced;
    this.exit = exit;
    this.motion = { angle, x, y };
    if (returning || changedPreference) {
      this.world.reset(this.layout.logicalWidth, this.layout.logicalHeight, this.platform());
    }
    if (!visible || reduced || exit > 0) {
      this.stop();
      this.render();
    } else this.wake();
  }

  showContact(container: HTMLElement, active: boolean, reduced: boolean) {
    if (this.disposed) return;
    if (this.contactMode === active && this.reduced === reduced) return;
    this.stop();
    const changedMode = this.contactMode !== active;
    if (this.contactMode && !active) this.savedFloor = {
      width: this.world.width, height: this.world.height, floorY: this.world.platform.y,
      balls: this.world.balls.map(ball => ({ ...ball })),
    };
    this.contactMode = active;
    this.reduced = reduced;
    this.container = active ? container : this.homeContainer;
    this.container.append(this.renderer.domElement);
    this.container.append(this.hover);
    this.hideHover();
    this.container.dataset.mode = active ? 'contact' : 'hero';
    this.container.dataset.loaded = String(this.objects.length);
    this.visible = active;
    this.exit = 0;
    this.motion = { angle: 0, x: 0, y: 0 };
    this.accumulator = 0;
    if (active) {
      if (this.savedFloor && changedMode && !reduced) {
        this.world.resetFloor(this.savedFloor.width, this.savedFloor.height, this.savedFloor.floorY);
        this.world.balls = this.savedFloor.balls.map(ball => ({ ...ball }));
        this.world.resizeFloor(this.layout.logicalWidth, this.layout.logicalHeight, this.layout.logicalHeight - 72);
      } else this.world.resetFloor(this.layout.logicalWidth, this.layout.logicalHeight, this.layout.logicalHeight - 72, reduced || !changedMode);
    } else this.world.reset(this.layout.logicalWidth, this.layout.logicalHeight, this.platform());
    this.render(); this.wake();
  }

  private platform(): Platform {
    const { angle, x, y } = this.motion;
    const c = Math.cos(angle), s = Math.sin(angle);
    return {
      x: this.line.x + x + c * this.line.localX - s * this.line.localY,
      y: this.line.y + y + s * this.line.localX + c * this.line.localY,
      halfWidth: this.line.halfWidth, angle,
    };
  }

  private wake() {
    if (this.disposed || this.frame || !this.visible || this.reduced || this.exit > 0 || document.hidden) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private stop() {
    cancelAnimationFrame(this.frame); this.frame = 0; this.lastTime = 0;
  }

  private visibilityChange = () => {
    if (document.hidden) { this.stop(); this.clearHover(); }
    else this.wake();
  };

  private pointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' && !this.touchPointer) return;
    this.touchPointer = event.pointerType === 'touch';
    this.pointer = { x: event.clientX, y: event.clientY };
    this.updateHover();
  };

  private pointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    this.touchPointer = true;
    this.pointer = { x: event.clientX, y: event.clientY };
    this.updateHover();
  };

  private scrollHover = () => { if (this.touchPointer) this.clearHover(); else this.updateHover(); };

  private hideHover() {
    this.hovered = -1;
    this.hover.classList.remove('is-visible');
    delete this.hover.dataset.ball;
  }

  private clearHover = () => { this.pointer = undefined; this.hideHover(); };

  private updateHover = () => {
    if (!this.pointer || !this.visible || this.exit > 0 || !this.objects.length || document.hidden) {
      this.hideHover(); return;
    }
    const bounds = this.container.getBoundingClientRect();
    const x = (this.pointer.x - bounds.left) / this.layout.scale;
    const y = (this.pointer.y - bounds.top) / this.layout.scale;
    if (x < 0 || y < 0 || x > this.layout.logicalWidth || y > this.layout.logicalHeight) {
      this.hideHover(); return;
    }
    // Match the rendered soft-ball silhouette, including its impact deformation.
    let index = this.world.balls.findIndex(ball =>
      ((x - ball.x) / (ball.radius * (1 + ball.squash * 0.55))) ** 2
      + ((y - ball.y) / (ball.radius * (1 - ball.squash))) ** 2 <= 1);
    if (index < 0 && this.hovered >= 0) {
      const pill = this.hover.getBoundingClientRect();
      if (this.pointer.x >= pill.left && this.pointer.x <= pill.right
        && this.pointer.y >= pill.top && this.pointer.y <= pill.bottom) index = this.hovered;
    }
    if (index < 0) { this.hideHover(); return; }
    const ball = this.world.balls[index];
    const width = this.hover.offsetWidth, height = this.hover.offsetHeight;
    let left = ball.x + ball.radius * 0.42;
    if (left + width > this.layout.logicalWidth - 12) left = ball.x - ball.radius * 0.42 - width;
    left = Math.max(12, Math.min(left, this.layout.logicalWidth - width - 12));
    const top = Math.max(12, Math.min(ball.y - ball.radius * 0.9, this.layout.logicalHeight - height - 12));
    this.hover.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    this.hover.dataset.ball = NETWORKS[index];
    this.hovered = index;
    this.hover.classList.add('is-visible');
  };

  private tick = (time: number) => {
    this.frame = 0;
    if (this.disposed || !this.visible || this.reduced || this.exit > 0 || document.hidden) return;
    const elapsed = Math.min(this.lastTime ? (time - this.lastTime) / 1000 : STEP, 0.05);
    this.lastTime = time;
    if (!this.contactMode) this.world.setPlatform(this.platform(), elapsed);
    this.accumulator += elapsed;
    while (this.accumulator >= STEP) { this.world.step(STEP); this.accumulator -= STEP; }
    this.render();
    if (time - this.diagnosticTime > 120) {
      this.diagnosticTime = time;
      this.container.dataset.tilt = this.motion.angle.toFixed(5);
      this.container.dataset.balls = JSON.stringify(this.world.balls.map(ball => ({
        x: +ball.x.toFixed(1), y: +ball.y.toFixed(1),
        squash: +ball.squash.toFixed(3), grounded: ball.grounded,
        bounces: ball.bounces, recycles: ball.recycles,
      })));
    }
    if (this.world.moving) this.wake(); else this.lastTime = 0;
  };

  private render() {
    if (this.disposed) return;
    const { logicalWidth: width, logicalHeight: height } = this.layout;
    this.objects.forEach((object, index) => {
      const ball = this.world.balls[index];
      const fold = smooth(range(this.exit, index * 0.12, 1));
      const shrink = 1 - fold;
      object.position.set(
        (ball.x - width / 2) * shrink,
        (height / 2 - ball.y) * shrink + Math.sin(fold * Math.PI) * (180 + index * 65),
        100 - fold * 700,
      );
      object.rotation.z = (ball.grounded ? -this.motion.angle : 0) + fold * (index % 2 ? -1 : 1) * 2;
      object.scale.set((1 + ball.squash * 0.55) * shrink, (1 - ball.squash) * shrink, (1 + ball.squash * 0.55) * shrink);
      object.visible = this.visible && shrink > 0;
      this.spins[index].rotation.set(Math.sin(ball.spin * 0.3) * 0.12 + fold * 3, Math.sin(ball.spin * 0.2) * 0.18 + fold * 5, -ball.spin);
      const shadow = this.shadows[index];
      shadow.position.set(ball.x - width / 2, height / 2 - (ball.y + ball.radius * (1 - ball.squash)), 0);
      shadow.scale.set(ball.radius * 1.75, 12, 1);
      shadow.visible = ball.grounded && this.visible && this.exit < 0.02;
    });
    this.renderer.render(this.scene, this.camera);
    this.container.dataset.exit = this.exit.toFixed(4);
    this.container.dataset.moving = String(this.world.moving);
    this.updateHover();
  }

  private disposeModel(root: THREE.Object3D) {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        Object.values(material).forEach(value => { if (value instanceof THREE.Texture) value.dispose(); });
        material.dispose();
      });
    });
  }

  dispose() {
    this.disposed = true; this.stop();
    document.removeEventListener('visibilitychange', this.visibilityChange);
    window.removeEventListener('pointermove', this.pointerMove);
    window.removeEventListener('pointerdown', this.pointerDown);
    window.removeEventListener('scroll', this.scrollHover);
    window.removeEventListener('blur', this.clearHover);
    document.documentElement.removeEventListener('pointerleave', this.clearHover);
    this.disposeModel(this.scene);
    this.shadows.forEach(shadow => (shadow.material as THREE.SpriteMaterial).dispose());
    this.shadowTexture.dispose(); this.renderer.dispose();
    this.renderer.domElement.remove();
    this.hover.remove();
  }
}
