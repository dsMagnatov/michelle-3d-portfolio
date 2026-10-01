# Verification — revised wall-typography prototype

Latest revision: mobile layouts, touch controls and a new 3D-designer descriptor, 2026-10-01. Historical checks below describe earlier designs.

## Mobile and descriptor revision

- Replaced the unrelated finance copy with a descriptor about curious ideas becoming playful 3D objects and little worlds through form, materials, light and motion. The foreground statement is “PLAYFUL DIMENSIONS”; only the main greeting uses “I'm”. Updated the page description metadata. The same measured line boxes supply the architectural wall texture.
- Verified portrait layouts at 320×568 and 390×844, including first-screen line bounds, the model, stable ball rest, the portfolio endpoint and ordinary scrolling to contact. No horizontal overflow or clipped text. Corrected preview placement on the short 320 px screen to keep the header clear.
- Checked the project dialog on 390×844: the image and description stack in one column, the close control is visible, and close returns to the selected work. The mobile preview stays above the rows.
- At 320×568, all three contact balls settled with no recycling and `moving=false`. Contact heading and email fit the viewport. Resizing and changing orientation to 667×375 returned to the compact desktop composition; rotating back restored mobile line breaks and model placement.
- Added touch handlers for caption tilt, horizontal tunnel look and ball pills. Vertical scrolling is preserved with `touch-action: pan-y`; touch hover clears on scroll. These event paths were reviewed in code; the browser verification used resized viewports and native mouse/keyboard input, not physical phones.
- Portrait WebGL layers cap pixel density at 1.5; the scene uses a smaller depth target, wider 64° field of view and clearer white surface shading. The endpoint depends on the field of view, retaining the matching HTML portfolio handoff.
- TypeScript, production build and physics checks passed. Browser warning/error log was empty. Restored the default viewport after checking.
- Narrow mobile caption contacts continue solving until the balls no longer overlap. Added a focused regression check for this settling behavior.
- First production load exposed a brief portfolio flash before its images finished decoding. Home now stays visible until the scene is ready; the HTML fallback activates only on an actual WebGL failure.
- Captures: `artifacts/v9-mobile-home.png`, `artifacts/v9-mobile-home-small.png`, `artifacts/v9-mobile-portfolio.png`, `artifacts/v9-mobile-contact-small.png`.

## Social-ball hover revision

- Matched the supplied hover reference with a grey translucent, rounded pill, 14 px backdrop blur and blue Anton “OPEN LINK ↗”. The overlay follows current ball coordinates and deformation and flips away from the right edge when needed.
- Viewed the X hover on Home while the caption tilted and the balls moved. The overlay stayed aligned with the ball; it clears during the scroll-driven 3D departure.
- Verified X / Twitter, Pinterest and Behance independently on contact. Each showed the matching hover state; resting physics stayed asleep and document scroll stayed at 6480.
- Moving onto the pill retained it; moving into empty space hid it. The overlay uses no pointer interception and no social URLs are configured, following the user's earlier instruction.
- Production build and TypeScript checking passed. Browser warning/error log was empty. Reduced-motion styling disables the pill's entrance transition.
- Capture: `artifacts/v8-ball-hover.png`.

## White portfolio and contact revision

- Portfolio and contact backgrounds are white (`rgb(255, 255, 255)`). The contact layout uses Anton, large “Want to reach out?” lettering, `hello@example.com`, and text-only X / Twitter, Pinterest and Behance labels, as authorized by the user.
- Removed layout-driven preview movement, repeated image decoding and hover-triggered wall texture rebuilding. Images are decoded once; one GSAP transform handles rapid changes. Browser render/build counters stayed unchanged during consecutive row selections after the initial scroll animation settled.
- Reproduced focus scrolling inside the hidden-overflow stage. Replaced its overflow with `clip`, kept Tab/Shift+Tab navigation within visible rows from scrolling, and preserved the original document position when closing a project. Native clicks, keyboard navigation and close were checked at `scrollY=5760`, with stage scroll zero and the portfolio at the viewport origin.
- Reverse scroll returned to the architectural scene and captured the selected work once for its wall texture. Returning to the endpoint restored the interactive HTML portfolio.
- At 1280×720, the journey ends at scroll 5760; further ordinary scrolling moves the portfolio up and brings the contact section to the top at scroll 6480. The contact is not pinned.
- Reused the existing ball renderer and models: one canvas moves from Home to contact, with no additional model loading. Observed all three balls start above the viewport, fall, rebound three times and settle with compression 0.04. Recycling stayed zero and the simulation reported `moving=false` at rest.
- Scrolled away and back: all balls remained grounded with unchanged rebound/recycling counts and effectively unchanged positions. Resizing to 1786×1244 preserved floor contacts; lettering and email stayed inside the viewport. No horizontal overflow at either tested size. Restored the default viewport after checking.
- `node scripts/verify-ball-physics.mjs` passed: caption rolling/recycling, soft rebounds, footer falling/settling, bounded side contacts, no footer recycling, resize and reduced-motion static pose. Reduced-motion rendering paths were reviewed in code; no OS preference was changed.
- TypeScript and production build passed. Browser warning/error log was empty. The build retains the existing Three.js bundle-size advisory.
- Captures: `artifacts/v7-portfolio-white.png`, `artifacts/v7-contact-final.png`, `artifacts/v7-contact-1786x1244.png`.

## Arches and portfolio revision

- Reviewed the live Design is Funny work list and Reijo’s 3D product illustrations in the browser. Generated three separate original object studies and inspected each result; PNG originals and optimized WebP assets are in `public/work`, prompts in `IMAGE-PROMPTS.md`.
- Verified that the upper heading and subtitle keep `transform: none` when the pointer moves. The lower caption reaches approximately ±6°, with the collider following the same transform. Avatar pointer response is preserved.
- Viewed intermediate model departure at scroll progress 0.063: the avatar rotates in 3D and contracts, while the balls spin and follow independent arcs. The transforms reverse with scroll. No alpha fade is used for these models.
- Viewed the hall at progress 0.42, 0.53 and 0.61, including looking to the side. Arches are actual geometry and open into coloured rooms with visible floors, walls and low steps. Corrected coplanar room/front-wall surfaces that initially produced edge flicker.
- Verified the final portfolio’s preview changes and opened/closed Quiet Orbit and Little Listener. The native dialog restores focus to its project button. All images and project descriptions load locally.
- Compared the wall texture at progress 0.98003 with the HTML endpoint at 1.0. Matching row and image positions; mean RGB difference was 2.078/255, including WebGL texture sampling and text antialiasing. Camera and wall sizing use the same viewport ratio.
- Checked 1280×720, 1786×1244 and 1366×768, including resize inside the tunnel, return to Home and the final portfolio. No horizontal overflow. Removed the temporary viewport override after testing.
- `node scripts/verify-ball-physics.mjs` passed, including the added comparison showing that 6° sends balls off sooner than 2°, and rolling works in either direction.
- Production build and TypeScript checks passed. Browser runtime error log was empty. Reduced motion and WebGL fallback paths were reviewed in code; no OS accessibility preference was changed.
- Captures: `artifacts/v6-arches.png`, `artifacts/v6-home-1786x1244.png`, `artifacts/v6-portfolio-1786x1244.png`, `artifacts/v6-portfolio-1366x768.png`, `artifacts/v6-portfolio-webgl.png`, `artifacts/v6-portfolio-html.png`.

## Viewport and soft-ball revision

- Reproduced the original window issue at 1786×1244: the centered 16:9 artboard left approximately 120 px above and below its contents.
- Replaced letterboxing with a shared viewport coordinate system for the HTML, avatar and balls. The three layers now start at (0,0) and fill the current viewport. Font proportions and fixed line breaks remain; the avatar anchors to the bottom without distortion.
- Verified live resize at 1786×1244, 1908×1244, 1366×768, 1000×1000 and 1600×650. No horizontal overflow. Resize resets stale pointer offsets and relocates the balls onto the new caption position.
- Inspected all three original GLBs and supplied images. Browser copies retain the original logos and textures, with 20,000 triangles per model and file sizes of 0.78–0.84 MB. Original files remain intact.
- Confirmed positive and negative caption tilt in the browser. Balls rolled, fell completely out of view and respawned above the viewport. Browser diagnostics recorded rebounds and recycling for all three balls; a landing compression of 0.171 was observed directly.
- The caption collider follows the measured glyph cap-height and the exact HTML translation/rotation. A small upward pivot adjustment keeps the tilted text inside the viewport.
- `node scripts/verify-ball-physics.mjs` passed: stable rest, rolling off the inclined caption, recycling, rebounds, finite state, bounded compression and resize reset.
- Production build and TypeScript checking passed. Browser error log was empty. Checked scroll handoff at progress 0.1401 and return to Home; avatar and ball layers clear before the painted-wall scene.
- Reduced-motion, hidden-tab pausing, sleeping at rest and disposal paths were reviewed in code. No system accessibility setting was changed.
- Captures: `artifacts/v5-home-1786x1244.jpg`, `artifacts/v5-home-1366x768.jpg`, `artifacts/v5-tilt-left.jpg`, `artifacts/v5-handoff.jpg`, `artifacts/v5-home-final.jpg`.

## Home and avatar revision

- Reviewed `home.png` and the supplied portrait. Matched the original wording, blue (#0033ff), fixed line breaks and layer order with locally bundled Anton.
- Used the supplied GLB, preserving its colour texture and UVs. Meshoptimizer reduced the browser copy from 65.89 MB / 1,996,661 triangles to 2.64 MB / 100,000 triangles. The original upload remains intact.
- Verified desktop composition at 1280×720, 1440×900, 1920×1080, 2560×1440 and 2560×1080. The artboard scales uniformly and centers within the viewport; no horizontal overflow.
- Verified independent motion of the heading, description and foreground statement. At one pointer position their horizontal offsets were −9.5, +14.25 and −17.42 design pixels. The avatar simultaneously rotated +0.158 radians horizontally and −0.057 vertically; the opposite pointer position reversed these motions.
- Checked the transition into the existing tunnel and reverse scrolling to Home. Compared blue-pixel bounds of the HTML text and painted surfaces at progress 0.14 after a fresh load: each text block agreed within 1 pixel of rasterization.
- Production build and TypeScript checking passed. Browser error log was empty. Reduced-motion handling was reviewed in code; no OS preference was changed.
- Current captures: `artifacts/v4-home-1920.jpg`, `artifacts/v4-home-1440x900.jpg`, `artifacts/v4-home-parallax-right.jpg`, `artifacts/v4-wall-handoff.jpg`.

Date: 2026-10-01. This document supersedes the verification of the earlier cube-based prototype.

- Production build and TypeScript checking passed. The remaining bundle-size advisory is for Three.js; no build errors.
- Browser runtime error log: no errors after the revision.
- DOM contains only the requested heading and subtitle. Zero header, navigation, button or dialog elements remain.
- No cube, cylinder details, stone textures, joints, fixtures or floating text meshes remain in scene code.
- No mobile breakpoints or alternate mobile composition remain.
- The text is sampled by the opaque wall material through a fixed world-space projector. Projector-depth occlusion prevents paint from passing through walls. Intermediate and final camera positions were viewed directly in the browser.
- Compared the opening HTML and the painted-wall version at progress 0.14. Heading dark-pixel bounds agree within 1–2 pixels of rasterization; subtitle bounds agree exactly. The initial camera has not moved at that progress.
- Desktop views checked at 1280×720 and 1440×900, including resize in the middle of the transition. Canvas dimensions matched the viewport; no horizontal overflow.
- Checked reverse scroll to the beginning and restored scroll after reload. The camera state is synchronized to the actual scroll offset after browser history restoration.
- System reduced-motion handling remains in code, with a static scene and no on-screen motion controls. No mobile or cross-browser testing was performed for this revision.

Current captures:

- `artifacts/v2-01-hero.jpg`
- `artifacts/v2-02-wall-handoff.jpg`
- `artifacts/v2-03-painted-walls.jpg`

The older captures without the v2 prefix belong to the previous design.

## Mouse look revision

- Production build and TypeScript checking passed after adding mouse look.
- Checked pointer positions on opposite sides of the viewport at scroll progress 0.51994. Yaw changed from negative to positive and pitch from positive to negative while scroll progress stayed unchanged.
- Returned to the opening with the pointer away from center: both camera angles returned to zero, hero opacity was 1, and scroll progress was zero.
- Browser error log was empty. Reduced-motion disabling and listener/tween cleanup were reviewed in code; the system preference was not changed during this check.
- Capture: `artifacts/v3-mouse-look.jpg`.
