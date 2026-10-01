import * as THREE from 'three';
import { choreography, range, smooth, START, PORTFOLIO_WALL } from './motion';
import type { Portfolio } from './portfolio';

const PAPER = '#ffffff';

const vertexShader = /* glsl */`
  uniform mat4 projectorMatrix;
  varying vec4 vProjected;
  varying vec3 vNormalWorld;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vProjected = projectorMatrix * world;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D lettering;
  uniform sampler2D projectorDepth;
  uniform vec3 paper;
  uniform float paint;
  uniform float architecture;
  uniform float room;
  uniform float shadeStrength;
  uniform vec3 lightPosition;
  varying vec4 vProjected;
  varying vec3 vNormalWorld;
  varying vec3 vWorld;
  void main() {
    vec3 ndc = vProjected.xyz / vProjected.w;
    vec2 uv = ndc.xy * 0.5 + 0.5;
    float inside = step(0.0, uv.x) * step(uv.x, 1.0)
      * step(0.0, uv.y) * step(uv.y, 1.0) * step(0.0, vProjected.w);
    float actualDepth = ndc.z * 0.5 + 0.5;
    float firstSurface = texture2D(projectorDepth, uv).r;
    // Occlusion from the ORIGINAL viewpoint prevents painting through the walls.
    // This is a stationary texture on opaque architecture, not a floating text mesh.
    // A receiver-plane bias avoids nearest-depth sampling stripes on long grazing walls.
    float depthBias = max(0.00015, 2.0 * fwidth(actualDepth));
    float visibleToProjector = step(actualDepth - depthBias, firstSurface);
    vec4 ink = texture2D(lettering, uv);
    float coverage = ink.a * inside * visibleToProjector * paint;
    vec3 n = normalize(vNormalWorld);
    float tone = 1.0 - 0.035 * abs(n.x) - 0.045 * max(-n.y, 0.0);
    tone -= 0.025 * max(n.x, 0.0);
    tone = mix(1.0, tone, shadeStrength);
    // Broad overhead illumination inside each coloured room, evaluated in world space.
    vec3 toLight = normalize(lightPosition - vWorld);
    float roomLight = 0.52 + 0.34 * max(dot(n, toLight), 0.0) + 0.14 * max(n.y, 0.0);
    tone = mix(tone, roomLight, room);
    // Quiet contact shading only: no stone noise, seams, trims, or decorative lighting.
    float floorEdge = (1.0 - smoothstep(0.0, 0.6, vWorld.y)) * abs(n.x) * 0.035;
    vec3 surface = mix(vec3(1.0), paper, architecture) * mix(1.0, tone - floorEdge, architecture);
    gl_FragColor = vec4(mix(surface, ink.rgb, coverage), 1.0);
    #include <colorspace_fragment>
  }
`;

export class SpatialScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(START.fov, 1, 0.1, 120);
  private projector = new THREE.PerspectiveCamera(START.fov, 1, 0.1, 120);
  private depthTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  private depthMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  private material: THREE.ShaderMaterial;
  private lettering: THREE.CanvasTexture | undefined;
  private roomMaterials: THREE.ShaderMaterial[] = [];
  private lightMaterials: THREE.MeshBasicMaterial[] = [];
  private portfolioTexture: THREE.CanvasTexture | undefined;
  private portfolioScreen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private progress = 0;
  private reduced = false;
  private lookX = 0;
  private lookY = 0;
  private disposed = false;
  private dirty = true;
  private portfolioBuilds = 0;
  private renders = 0;

  constructor(private container: HTMLElement, private portfolio: Portfolio) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(PAPER);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.container.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(PAPER);
    this.projector.position.set(START.x, START.y, START.z);
    this.projector.updateMatrixWorld();
    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: {
        projectorMatrix: { value: new THREE.Matrix4() },
        projectorDepth: { value: this.depthTarget.depthTexture },
        lettering: { value: null },
        paper: { value: new THREE.Color(PAPER) },
        paint: { value: 0 },
        architecture: { value: 0 },
        room: { value: 0 },
        shadeStrength: { value: 1 },
        lightPosition: { value: new THREE.Vector3(0, 7, 0) },
      },
    });
    this.createArchitecture();
    this.portfolioScreen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.portfolioScreen.position.set(0, PORTFOLIO_WALL.y, PORTFOLIO_WALL.z);
    this.scene.add(this.portfolioScreen);
    this.resize();
  }

  private createArchitecture() {
    const mass = (width: number, height: number, depth: number, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.material);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
    };
    // A white maquette: broad planes and deep openings, with no central object.
    mass(30, 0.4, 84, 0, -0.2, -14);
    mass(30, 0.4, 84, 0, 8.2, -14);
    mass(0.4, 8, 84, -14.2, 4, -14);
    mass(0.4, 8, 84, 14.2, 4, -14);
    mass(28, 8, 0.4, 0, 4, -52.4);
    // The deep reveals catch the text along their inner walls and front faces.
    for (const side of [-1, 1]) {
      mass(6.8, 8, 9, side * 6.6, 4, -0.5);
      mass(6.1, 8, 8, side * 6.95, 4, -19);
      mass(5.4, 8, 6, side * 7.3, 4, -37);
      this.createRoom(side, -10, 10, side < 0 ? '#93a8d9' : '#d79d80');
      this.createRoom(side, -28.5, 11, side < 0 ? '#a4b791' : '#d4ba7f');
    }
  }

  private createRoom(side: number, z: number, width: number, color: string) {
    const radius = 2.8, spring = 3.35;
    const entranceX = z > -20 ? 4.8 : 5.3;
    const interiorX = entranceX + 0.72;
    const roomDepth = 14 - interiorX;
    const roomCenter = (14 + interiorX) / 2;
    // The arch is a real open extrusion, with a deep reveal into a coloured room.
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(-radius, 0); shape.lineTo(-radius, spring);
    shape.absarc(0, spring, radius, Math.PI, 0, true);
    shape.lineTo(radius, 0); shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, 8); shape.lineTo(-width / 2, 8); shape.closePath();
    const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false, curveSegments: 48 }), this.material);
    arch.rotation.y = side * Math.PI / 2;
    arch.position.set(side * entranceX, 0, z); this.scene.add(arch);
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: { ...this.material.uniforms, paper: { value: new THREE.Color(color) }, room: { value: 1 }, lightPosition: { value: new THREE.Vector3(side * (roomCenter - 1), 7.6, z - 1) } },
    });
    this.roomMaterials.push(material);
    const block = (w: number, h: number, d: number, x: number, y: number, zz: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(side * x, y, zz); this.scene.add(mesh);
    };
    block(roomDepth, 0.12, width - 0.1, roomCenter, 0.025, z);
    block(roomDepth, 0.18, width - 0.1, roomCenter, 7.91, z);
    block(0.3, 7.85, width - 0.3, 14, 3.925, z);
    block(roomDepth, 7.85, 0.3, roomCenter, 3.925, z - width / 2 + 0.3);
    block(roomDepth, 7.85, 0.3, roomCenter, 3.925, z + width / 2 - 0.3);
    block(1.6, 0.7, 3, entranceX + 2.3, 0.43, z - 1.2);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: '#fff6dc', transparent: true, opacity: 0, depthWrite: false });
    this.lightMaterials.push(lightMaterial);
    const skylight = new THREE.Mesh(new THREE.BoxGeometry(3, 0.025, 4), lightMaterial);
    skylight.position.set(side * (roomCenter - 1), 7.805, z - 1); this.scene.add(skylight);
  }

  refreshPortfolio() {
    if (this.disposed || !this.portfolioScreen) return;
    this.portfolioTexture?.dispose();
    this.portfolioTexture = new THREE.CanvasTexture(this.portfolio.createTextureCanvas());
    this.portfolioTexture.colorSpace = THREE.SRGBColorSpace;
    this.portfolioTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.portfolioScreen.material.map = this.portfolioTexture;
    this.portfolioScreen.material.needsUpdate = true;
    this.dirty = true;
    this.container.dataset.portfolioBuilds = String(++this.portfolioBuilds);
    this.update(this.progress, this.reduced);
  }

  private rebuildLettering(width: number, height: number) {
    const ratio = Math.min(2, 4096 / width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    const origin = document.querySelector<HTMLElement>('.hero')!.getBoundingClientRect();
    // Both texts use their exact DOM line boxes; there is no independently laid-out 3D copy.
    document.querySelectorAll<HTMLElement>('.title-line, .subtitle span').forEach(line => {
      const bounds = line.getBoundingClientRect();
      const style = getComputedStyle(line);
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.letterSpacing = style.letterSpacing;
      ctx.fillStyle = style.color;
      ctx.textBaseline = 'alphabetic';
      const metrics = ctx.measureText(line.textContent!);
      const scale = bounds.height / parseFloat(style.lineHeight);
      const baseline = (parseFloat(style.lineHeight) - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
        + metrics.fontBoundingBoxAscent;
      ctx.save();
      ctx.translate(bounds.left - origin.left, bounds.top - origin.top);
      ctx.scale(scale, scale);
      ctx.fillText(line.textContent!, 0, baseline);
      ctx.restore();
    });
    this.lettering?.dispose();
    this.lettering = new THREE.CanvasTexture(canvas);
    this.lettering.colorSpace = THREE.SRGBColorSpace;
    this.lettering.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.material.uniforms.lettering.value = this.lettering;
  }

  resize() {
    this.dirty = true;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const mobile = width <= 767 && height >= width;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setSize(width, height);
    this.camera.fov = this.projector.fov = mobile ? 64 : START.fov;
    this.material.uniforms.shadeStrength.value = mobile ? 2.2 : 1;
    this.camera.aspect = this.projector.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.portfolioScreen.scale.set(PORTFOLIO_WALL.height * width / height, PORTFOLIO_WALL.height, 1);
    this.refreshPortfolio();
    this.projector.updateProjectionMatrix();
    this.projector.updateMatrixWorld();
    this.material.uniforms.projectorMatrix.value.multiplyMatrices(this.projector.projectionMatrix, this.projector.matrixWorldInverse);
    // Capture the resting artboard, even if the pointer was off-center during resize.
    const layers = Array.from(document.querySelectorAll<HTMLElement>('.hero-title, .subtitle, .hero-footer'));
    const transforms = layers.map(layer => layer.style.transform);
    layers.forEach(layer => { layer.style.transform = 'none'; });
    this.rebuildLettering(width, height);
    layers.forEach((layer, index) => { layer.style.transform = transforms[index]; });
    // Bake the first-hit depth from the fixed projector only when the viewport changes.
    const depthScale = mobile ? 1 : 1.5;
    this.depthTarget.setSize(Math.ceil(width * depthScale), Math.ceil(height * depthScale));
    this.scene.overrideMaterial = this.depthMaterial;
    this.renderer.setRenderTarget(this.depthTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.projector);
    this.renderer.setRenderTarget(null);
    this.scene.overrideMaterial = null;
    this.update(this.progress, this.reduced);
  }

  update(progress: number, reduced = false, lookX = this.lookX, lookY = this.lookY) {
    if (this.disposed) return;
    if (!this.dirty && progress === this.progress && reduced === this.reduced && lookX === this.lookX && lookY === this.lookY) return;
    this.progress = progress;
    this.reduced = reduced;
    this.lookX = lookX;
    this.lookY = lookY;
    const m = choreography(reduced ? 0.54 : progress, this.camera.fov);
    // Keep the initial HTML/projected-text alignment exact; enable looking inside the hall.
    const lookStrength = reduced ? 0 : smooth(range(progress, 0.2, 0.42)) * (1 - smooth(range(progress, 0.72, 0.94)));
    const pitch = -lookY * 0.14 * lookStrength;
    const yaw = m.yaw - lookX * 0.24 * lookStrength;
    this.camera.position.set(m.cameraX, m.cameraY, m.cameraZ);
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
    this.container.dataset.lookYaw = yaw.toFixed(5);
    this.container.dataset.lookPitch = pitch.toFixed(5);
    this.material.uniforms.paint.value = m.paint ? 1 : 0;
    this.material.uniforms.architecture.value = m.architecture;
    this.lightMaterials.forEach(material => { material.opacity = m.architecture; });
    this.portfolioScreen.material.opacity = smooth(range(progress, 0.42, 0.66));
    this.container.dataset.cameraZ = m.cameraZ.toFixed(4);
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
    this.container.dataset.renders = String(++this.renders);
  }

  dispose() {
    this.disposed = true;
    this.scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    this.lettering?.dispose();
    this.portfolioTexture?.dispose();
    this.portfolioScreen.material.dispose();
    this.roomMaterials.forEach(material => material.dispose());
    this.lightMaterials.forEach(material => material.dispose());
    this.depthTarget.dispose();
    this.depthMaterial.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
