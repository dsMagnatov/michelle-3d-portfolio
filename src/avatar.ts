import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DESIGN, type CompositionLayout } from './layout';
import { smooth } from './motion';

/** A separate transparent layer keeps the bust between the two typographic planes. */
export class AvatarScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-960, 960, 540, -540, 1, 6000);
  private pivot = new THREE.Group();
  private disposed = false;
  private look = { x: 0, y: 0 };
  private modelScale = 1;
  private neckOffset = 0;
  private exit = 0;

  constructor(private container: HTMLElement, private layout: CompositionLayout) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0xffffff, 0);
    this.camera.position.z = 3000;
    this.scene.add(this.pivot);
    container.append(this.renderer.domElement);
    this.resize(layout);
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync('/avatar.glb');
    const root = gltf.scene;
    if (this.disposed) {
      this.disposeModel(root);
      return;
    }
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    this.modelScale = 992 / size.y;
    // Rotate around the neck, retaining the original bust's proportions and portrait pose.
    const neck = bounds.min.y + size.y * 0.63;
    root.position.set(-center.x, -neck, -center.z);
    this.neckOffset = neck - bounds.min.y;
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const original = object.material as THREE.MeshStandardMaterial;
      // The supplied portrait already carries baked lighting in its colour texture.
      object.material = new THREE.MeshBasicMaterial({ map: original.map, color: original.color });
      original.normalMap?.dispose();
      original.metalnessMap?.dispose();
      original.roughnessMap?.dispose();
      original.dispose();
    });
    this.pivot.add(root);
    this.container.dataset.loaded = 'true';
    this.update(this.look.x, this.look.y, this.exit);
  }

  resize(layout: CompositionLayout) {
    this.layout = layout;
    this.camera.left = -layout.logicalWidth / 2;
    this.camera.right = layout.logicalWidth / 2;
    this.camera.top = layout.logicalHeight / 2;
    this.camera.bottom = -layout.logicalHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, layout.mobile ? 1.5 : 2));
    this.renderer.setSize(Math.round(layout.width), Math.round(layout.height), false);
    this.update(this.look.x, this.look.y, this.exit);
  }

  update(x: number, y: number, exit = this.exit) {
    if (this.disposed) return;
    this.look = { x, y };
    this.exit = exit;
    const fold = smooth(exit);
    const { logicalWidth, logicalHeight, avatarScale } = this.layout;
    const scale = this.modelScale * avatarScale;
    // A reversible corkscrew fold: full 3D rotation, with a delayed vertical collapse.
    this.pivot.scale.set(scale * (1 - fold), scale * (1 - Math.pow(fold, 1.5)), scale * (1 - fold));
    const baseY = -logicalHeight / 2 - 2 * avatarScale + this.neckOffset * scale;
    this.pivot.position.set(
      (this.layout.mobile ? x * 20 - fold * 60 : (458 + x * 32 - fold * 140) * logicalWidth / DESIGN.width),
      baseY - y * 24 * logicalHeight / DESIGN.height - fold * 240 * avatarScale,
      -fold * 700,
    );
    this.pivot.rotation.set(y * 0.1 + fold * 0.3, x * 0.2 - fold * Math.PI * 1.4, -x * 0.018 - fold * 0.3, 'YXZ');
    this.pivot.visible = exit < 1;
    this.container.dataset.exit = exit.toFixed(4);
    this.container.dataset.yaw = this.pivot.rotation.y.toFixed(5);
    this.container.dataset.pitch = this.pivot.rotation.x.toFixed(5);
    this.renderer.render(this.scene, this.camera);
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
    this.disposed = true;
    this.disposeModel(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
