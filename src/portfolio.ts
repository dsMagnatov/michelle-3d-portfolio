import gsap from 'gsap';
import { measureComposition } from './layout';

export const WORKS = [
  {
    title: 'Quiet Orbit', slug: 'quiet-orbit',
    services: 'Art direction / 3D / Materials', type: 'Object study',
    description: 'An orbital sculpture in oak, brass and ceramic. Concentric rings turn a familiar astronomical idea into a warm, tactile desk object. A study of balance, joinery and afternoon light.',
    alt: 'Three wooden orbital rings holding a ceramic sphere and a small blue satellite on a brass axle.',
  },
  {
    title: 'Little Listener', slug: 'little-listener',
    services: '3D / Product / Lighting', type: 'Sound sculpture',
    description: 'An imaginary listening device with a wooden horn, a looping brass tube and a ceramic dial. A playful exploration of sound through sculptural proportions and carefully lit natural materials.',
    alt: 'A flared wooden acoustic horn on a brass coil above an oak base with a red ceramic dial.',
  },
  {
    title: 'Soft Switch', slug: 'soft-switch',
    services: '3D / Colour / Surface design', type: 'Tactile experiment',
    description: 'A blue, softly padded controller set into a carved oak cradle. Cream buttons, an orange lever and a textile cable explore the contrast between soft surfaces and precise mechanical details.',
    alt: 'A soft blue controller with cream buttons and an orange lever on an oak stand.',
  },
] as const;

/** The same DOM is measured for the wall texture and becomes interactive at the end. */
export class Portfolio {
  private images: HTMLImageElement[] = [];
  private selected = 0;
  private active = false;
  private dialog = document.querySelector<HTMLDialogElement>('.project-dialog')!;
  private rows: HTMLButtonElement[];
  private preview: HTMLElement;
  private movePreview: ReturnType<typeof gsap.quickTo>;
  private projectOrigin?: { button: HTMLButtonElement; x: number; y: number };

  constructor(readonly container: HTMLElement, private onChange: () => void) {
    container.innerHTML = `
      <header class="portfolio-header">
        <h2 class="portfolio-heading portfolio-copy">SELECTED WORK</h2>
        <p class="portfolio-note portfolio-copy">3D OBJECTS &amp; LITTLE WORLDS</p>
      </header>
      <figure class="work-preview">${WORKS.map((work, index) => `<img class="${index === 0 ? 'is-selected' : ''}" src="/work/${work.slug}.webp" alt="${work.alt}" aria-hidden="${index !== 0}" />`).join('')}</figure>
      <div class="work-list">${WORKS.map((work, index) => `
        <button class="work-row${index === 0 ? ' is-selected' : ''}" type="button" data-work="${index}" aria-label="View ${work.title}">
          <span class="work-name portfolio-copy">${work.title}</span>
          <span class="work-services portfolio-copy">${work.services}</span>
          <span class="work-type portfolio-copy">${work.type}</span>
          <span class="work-arrow portfolio-copy" aria-hidden="true">↗</span>
        </button>`).join('')}
      </div>
      <p class="portfolio-footnote portfolio-copy">MATERIAL, LIGHT, A LITTLE CURIOSITY.</p>`;
    this.rows = Array.from(container.querySelectorAll<HTMLButtonElement>('.work-row'));
    this.preview = container.querySelector<HTMLElement>('.work-preview')!;
    this.images = Array.from(this.preview.querySelectorAll<HTMLImageElement>('img'));
    this.movePreview = gsap.quickTo(this.preview, 'y', { duration: 0.45, ease: 'power3.out' });
    this.rows.forEach(row => {
      row.addEventListener('pointerenter', this.selectRow);
      row.addEventListener('focus', this.selectRow);
      row.addEventListener('click', this.openProject);
      row.addEventListener('keydown', this.navigateRows);
    });
    this.dialog.querySelector('.project-close')!.addEventListener('click', this.closeProject);
    this.dialog.addEventListener('click', this.backdropClick);
    this.dialog.addEventListener('close', this.restoreProjectFocus);
  }

  async load() {
    // Decode the displayed elements once; changing rows never changes an image URL.
    await Promise.all(this.images.map(img => img.decode()));
  }

  resize() {
    this.movePreview.tween.pause();
    gsap.set(this.preview, { y: this.previewY() });
  }

  setActive(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    this.container.classList.toggle('is-active', active);
    this.container.inert = !active;
    this.container.setAttribute('aria-hidden', String(!active));
    if (!active && this.dialog.open) {
      this.projectOrigin = undefined;
      this.dialog.close();
    }
    if (!active) {
      this.movePreview.tween.pause();
      // Capture once when returning to the wall, never during a normal row hover.
      this.onChange();
    } else this.movePreview(this.previewY());
  }

  private selectRow = (event: Event) => {
    const index = Number((event.currentTarget as HTMLElement).dataset.work);
    if (index === this.selected) return;
    this.selected = index;
    this.rows.forEach((row, i) => row.classList.toggle('is-selected', i === index));
    this.images.forEach((img, i) => {
      img.classList.toggle('is-selected', i === index);
      img.setAttribute('aria-hidden', String(i !== index));
    });
    const y = this.previewY();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.set(this.preview, { y });
    else this.movePreview(y);
  };

  private previewY() {
    return measureComposition(this.container).mobile ? 0 : this.selected * this.container.clientHeight * 0.16;
  }

  private openProject = (event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    this.projectOrigin = { button, x: window.scrollX, y: window.scrollY };
    const work = WORKS[Number(button.dataset.work)];
    const img = this.dialog.querySelector<HTMLImageElement>('.project-image')!;
    img.src = `/work/${work.slug}.webp`; img.alt = work.alt;
    this.dialog.querySelector('#project-title')!.textContent = work.title;
    this.dialog.querySelector('.project-discipline')!.textContent = work.services;
    this.dialog.querySelector('.project-description')!.textContent = work.description;
    this.dialog.showModal();
  };

  private navigateRows = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const index = this.rows.indexOf(event.currentTarget as HTMLButtonElement);
    const next = this.rows[index + (event.shiftKey ? -1 : 1)];
    if (!next) return;
    // Native focus scrolling mismeasures children of a sticky stage in Chromium.
    event.preventDefault();
    next.focus({ preventScroll: true });
  };

  private restoreProjectFocus = () => {
    const origin = this.projectOrigin;
    this.projectOrigin = undefined;
    if (!origin || !this.active) return;
    origin.button.focus({ preventScroll: true });
    window.scrollTo(origin.x, origin.y);
  };

  private closeProject = () => {
    this.dialog.close();
    this.restoreProjectFocus();
  };
  private backdropClick = (event: MouseEvent) => {
    if (event.target !== this.dialog) return;
    const rect = this.dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.closeProject();
  };

  createTextureCanvas() {
    const origin = this.container.getBoundingClientRect();
    const width = origin.width, height = origin.height;
    const ratio = Math.min(2, 4096 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = getComputedStyle(this.container).backgroundColor;
    ctx.fillRect(0, 0, width, height);
    const preview = this.preview.getBoundingClientRect();
    const img = this.images[this.selected];
    if (img) ctx.drawImage(img, preview.left - origin.left, preview.top - origin.top, preview.width, preview.height);
    this.rows.forEach(row => {
      const rect = row.getBoundingClientRect(), style = getComputedStyle(row);
      ctx.fillStyle = style.borderBottomColor;
      ctx.fillRect(rect.left - origin.left, rect.bottom - origin.top - 1, rect.width, 1);
    });
    this.container.querySelectorAll<HTMLElement>('.portfolio-copy').forEach(element => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      ctx.save();
      ctx.globalAlpha = Number(style.opacity);
      ctx.fillStyle = style.color;
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.letterSpacing = style.letterSpacing;
      const text = element.textContent!.trim();
      const metrics = ctx.measureText(text);
      const lineHeight = parseFloat(style.lineHeight);
      const baseline = (lineHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent;
      if (style.transform !== 'none') {
        const matrix = new DOMMatrix(style.transform);
        ctx.translate(rect.left - origin.left + rect.width / 2, rect.top - origin.top + rect.height / 2);
        ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
        ctx.fillText(text, -element.offsetWidth / 2, baseline - element.offsetHeight / 2);
      } else {
        const x = rect.left - origin.left + (style.textAlign === 'right' ? rect.width - parseFloat(style.paddingRight) - metrics.width : 0);
        ctx.fillText(text, x, rect.top - origin.top + baseline);
      }
      ctx.restore();
    });
    return canvas;
  }

  dispose() {
    this.rows.forEach(row => {
      row.removeEventListener('pointerenter', this.selectRow);
      row.removeEventListener('focus', this.selectRow);
      row.removeEventListener('click', this.openProject);
      row.removeEventListener('keydown', this.navigateRows);
    });
    this.dialog.querySelector('.project-close')!.removeEventListener('click', this.closeProject);
    this.dialog.removeEventListener('click', this.backdropClick);
    this.dialog.removeEventListener('close', this.restoreProjectFocus);
    this.movePreview.tween.kill();
    if (this.dialog.open) this.dialog.close();
  }
}
