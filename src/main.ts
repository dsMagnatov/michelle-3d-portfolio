import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SpatialScene } from './scene';
import { AvatarScene } from './avatar';
import { SocialBalls } from './social-balls';
import { Portfolio } from './portfolio';
import { choreography, clamp, range, smooth } from './motion';
import { measureComposition, type CompositionLayout } from './layout';

gsap.registerPlugin(ScrollTrigger);

const stage = document.querySelector<HTMLElement>('.stage')!;
const hero = document.querySelector<HTMLElement>('.hero')!;
const title = document.querySelector<HTMLElement>('.hero-title')!;
const subtitle = document.querySelector<HTMLElement>('.subtitle')!;
const footer = document.querySelector<HTMLElement>('.hero-footer')!;
const avatarLayer = document.querySelector<HTMLElement>('.avatar')!;
const ballLayer = document.querySelector<HTMLElement>('.social-balls')!;
const contact = document.querySelector<HTMLElement>('.contact')!;
const contactBallLayer = document.querySelector<HTMLElement>('.contact-balls')!;
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const portfolio = new Portfolio(document.querySelector<HTMLElement>('.portfolio')!, () => scene?.refreshPortfolio());
let scene: SpatialScene | undefined;
let avatar: AvatarScene | undefined;
let balls: SocialBalls | undefined;
let animation: gsap.core.Tween | undefined;
let lookAnimation: gsap.core.Timeline | undefined;
let contactTrigger: ScrollTrigger | undefined;
let resizeFrame = 0;
const playhead = { progress: 0 };
const look = { x: 0, y: 0 };
const layers = {
  footer: { x: 0, y: 0 }, avatar: { x: 0, y: 0 },
};
let layout: CompositionLayout;
let touchCaption = false;
let touchHall = false;
document.documentElement.classList.toggle('reduced-motion', preference.matches);
fitComposition();

function fitComposition() {
  layout = measureComposition(hero);
  if (hero.dataset.layout !== (layout.mobile ? 'mobile' : 'desktop')) {
    title.innerHTML = layout.mobile
      ? '<span class="title-line">HI, I\'M</span><span class="title-line">MICHELLE</span>'
      : '<span class="title-line">HI, I\'M MICHELLE</span>';
    footer.innerHTML = layout.mobile
      ? '<span class="title-line">PLAYFUL</span><span class="title-line">DIMENSIONS</span>'
      : '<span class="title-line">PLAYFUL DIMENSIONS</span>';
    hero.dataset.layout = layout.mobile ? 'mobile' : 'desktop';
  }
  [hero, contact].forEach(element => {
    element.style.setProperty('--composition-scale', String(layout.scale));
    element.style.setProperty('--composition-width', `${layout.logicalWidth}px`);
    element.style.setProperty('--composition-height', `${layout.logicalHeight}px`);
  });
}

function render() {
  const p = playhead.progress;
  // Settle all layers before the exact HTML-to-painted-wall handoff.
  const strength = preference.matches ? 0 : 1 - smooth(range(p, 0.035, 0.11));
  title.style.transform = 'none';
  subtitle.style.transform = 'none';
  const footerX = layers.footer.x * -22 * strength;
  const footerAngle = layers.footer.x * 0.105 * strength;
  // Lift the pivot just enough to keep the lower end of the tilted phrase inside the window.
  const footerY = layers.footer.y * -14 * strength - Math.abs(Math.sin(footerAngle)) * footer.offsetWidth / 2;
  footer.style.transform = `translate(${footerX}px, ${footerY}px) rotate(${footerAngle}rad)`;
  const exit = preference.matches ? 0 : range(p, 0.025, 0.115);
  balls?.setMotion(footerAngle, footerX, footerY, p < 0.12 || preference.matches, preference.matches, exit);
  avatar?.update(layers.avatar.x * strength, layers.avatar.y * strength, exit);
  hero.style.opacity = !preference.matches && choreography(p).paint ? '0' : '1';
  hero.setAttribute('aria-hidden', String(!preference.matches && choreography(p).paint));
  scene?.update(p, preference.matches, look.x, look.y);
  portfolio.setActive(preference.matches || !scene || p >= 0.985);
  stage.dataset.progress = p.toFixed(5);
  stage.dataset.motion = preference.matches ? 'reduced' : 'full';
}

function moveLook(x: number, y: number) {
  lookAnimation?.kill();
  lookAnimation = gsap.timeline({ onUpdate: render, defaults: { ease: 'power2.out' } })
    .to(look, { x, y, duration: 0.65 }, 0)
    .to(layers.footer, { x, y, duration: 0.55 }, 0)
    .to(layers.avatar, { x, y, duration: 0.75 }, 0);
}

function pointerMove(event: PointerEvent) {
  if ((event.pointerType !== 'mouse' && !touchCaption && !touchHall) || preference.matches || playhead.progress >= 0.94) return;
  const bounds = hero.getBoundingClientRect();
  moveLook(
    clamp((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    clamp((event.clientY - bounds.top) / bounds.height) * 2 - 1,
  );
}

function startCaptionTouch(event: PointerEvent) {
  if (event.pointerType !== 'touch' || !layout.mobile || playhead.progress >= 0.12) return;
  touchCaption = true;
  footer.setPointerCapture(event.pointerId);
  pointerMove(event);
}

function endCaptionTouch() {
  if (!touchCaption && !touchHall) return;
  touchCaption = touchHall = false;
  recenterLook();
}

function startHallTouch(event: PointerEvent) {
  if (event.pointerType !== 'touch' || preference.matches || playhead.progress < 0.2 || playhead.progress >= 0.94
    || !(event.target instanceof Element) || !event.target.closest('.scene')) return;
  touchHall = true;
  stage.setPointerCapture(event.pointerId);
  pointerMove(event);
}

function recenterLook() {
  if (!preference.matches && playhead.progress < 0.94) moveLook(0, 0);
}

function resetLook() {
  lookAnimation?.kill();
  look.x = look.y = 0;
  Object.values(layers).forEach(layer => { layer.x = layer.y = 0; });
}

function setupScroll() {
  animation?.scrollTrigger?.kill();
  animation?.kill();
  playhead.progress = 0;
  if (!preference.matches && scene) {
    animation = gsap.to(playhead, {
      progress: 1, ease: 'none', onUpdate: render,
      scrollTrigger: {
        trigger: '.journey', start: 'top top', end: 'bottom bottom',
        scrub: 0.55, invalidateOnRefresh: true,
        onRefresh: self => { animation?.progress(self.progress); },
        // The sticky stage releases into ordinary document scrolling at this boundary.
        onUpdate: self => { if (self.progress === 1) self.getTween()?.progress(1); },
      },
    });
  }
  setupContact();
  render();
}

function setupContact() {
  contactTrigger?.kill();
  const toggle = (active: boolean) => balls?.showContact(contactBallLayer, active, preference.matches);
  contactTrigger = ScrollTrigger.create({
    trigger: contact, start: 'top 35%', end: 'bottom top',
    onEnter: () => toggle(true), onEnterBack: () => toggle(true), onLeaveBack: () => toggle(false),
  });
  toggle(contactTrigger.isActive);
}

function resize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const next = measureComposition(hero);
    if (next.width !== layout.width || next.height !== layout.height) resetLook();
    fitComposition();
    portfolio.resize();
    avatar?.resize(layout);
    balls?.resize(layout);
    scene?.resize();
    synchronizeScroll();
    render();
  });
}

function synchronizeScroll() {
  ScrollTrigger.refresh();
  const trigger = animation?.scrollTrigger;
  if (!trigger || !animation) return;
  trigger.update();
  trigger.getTween()?.progress(1);
  const progress = clamp((window.scrollY - trigger.start) / (trigger.end - trigger.start));
  animation.progress(progress);
  playhead.progress = progress;
  render();
}

function restoreScroll() {
  // Browser history restoration can run after fonts and the first layout have settled.
  requestAnimationFrame(() => requestAnimationFrame(synchronizeScroll));
}

function changeMotion() {
  resetLook();
  document.documentElement.classList.toggle('reduced-motion', preference.matches);
  setupScroll();
  resize();
}

function fallback(error: unknown) {
  console.error('The architectural scene could not be rendered:', error);
  animation?.scrollTrigger?.kill();
  animation?.kill();
  lookAnimation?.kill();
  scene?.dispose();
  scene = undefined;
  document.documentElement.classList.add('no-webgl');
  hero.style.opacity = '1';
  portfolio.setActive(true);
}

window.addEventListener('resize', resize);
const sizeObserver = new ResizeObserver(resize);
sizeObserver.observe(hero);
const visualViewport = window.visualViewport;
visualViewport?.addEventListener('resize', resize);
window.addEventListener('pageshow', restoreScroll);
window.addEventListener('pointermove', pointerMove);
footer.addEventListener('pointerdown', startCaptionTouch);
stage.addEventListener('pointerdown', startHallTouch);
window.addEventListener('pointerup', endCaptionTouch);
window.addEventListener('pointercancel', endCaptionTouch);
window.addEventListener('blur', recenterLook);
document.documentElement.addEventListener('pointerleave', recenterLook);
preference.addEventListener('change', changeMotion);

async function init() {
  await document.fonts.ready;
  try {
    fitComposition();
    avatar = new AvatarScene(avatarLayer, layout);
    avatar.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      avatar?.dispose(); avatar = undefined;
    });
    void avatar.load().then(render).catch(error => console.error('Avatar could not be loaded:', error));
  } catch (error) { console.error('Avatar could not be rendered:', error); }
  try {
    balls = new SocialBalls(ballLayer, footer, layout);
    balls.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); balls?.dispose(); balls = undefined;
    });
    void balls.load().then(() => { setupContact(); render(); }).catch(error => console.error('Social models could not be loaded:', error));
  } catch (error) { console.error('Social models could not be rendered:', error); }
  try {
    await portfolio.load();
    scene = new SpatialScene(document.querySelector<HTMLElement>('.scene')!, portfolio);
    scene.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); fallback('WebGL context lost.');
    });
    setupScroll();
    ScrollTrigger.refresh();
    restoreScroll();
    document.documentElement.dataset.ready = 'true';
  } catch (error) { fallback(error); }
}
void init();

if (import.meta.hot) import.meta.hot.dispose(() => {
  contactTrigger?.kill();
  portfolio.dispose();
  avatar?.dispose();
  balls?.dispose();
  scene?.dispose(); animation?.scrollTrigger?.kill(); animation?.kill();
  lookAnimation?.kill();
  cancelAnimationFrame(resizeFrame);
  sizeObserver.disconnect();
  visualViewport?.removeEventListener('resize', resize);
  window.removeEventListener('resize', resize);
  window.removeEventListener('pageshow', restoreScroll);
  window.removeEventListener('pointermove', pointerMove);
  footer.removeEventListener('pointerdown', startCaptionTouch);
  stage.removeEventListener('pointerdown', startHallTouch);
  window.removeEventListener('pointerup', endCaptionTouch);
  window.removeEventListener('pointercancel', endCaptionTouch);
  window.removeEventListener('blur', recenterLook);
  document.documentElement.removeEventListener('pointerleave', recenterLook);
  preference.removeEventListener('change', changeMotion);
});
