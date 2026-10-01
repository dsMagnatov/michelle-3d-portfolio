# Michelle — 3D portfolio

Interactive portfolio built with TypeScript, Three.js, GSAP ScrollTrigger and Vite, with desktop and mobile compositions.

[Live site](https://michelle-3d-portfolio.vercel.app/) · [Public GitHub repository](https://github.com/dsMagnatov/michelle-3d-portfolio)

## Run

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173. `pnpm build` type-checks and builds into `dist`; `pnpm preview` serves that build on port 4173.

## Current Home

The desktop first screen follows the supplied `home.png` at 1920×1080. Anton is bundled locally, with the original blue (#0033ff) and manual line breaks. The descriptor describes curious ideas becoming playful objects and little worlds through form, tactile materials, light and motion. The lower statement reads “PLAYFUL DIMENSIONS”. The heading and description sit behind the supplied avatar; the bottom statement sits in front.

The composition fills the actual browser viewport. A shared layout calculation fits the type proportionally, anchors the heading to the top and the foreground statement to the bottom, and keeps the avatar against the bottom edge. The avatar keeps its own proportions as the window's aspect ratio changes. ResizeObserver, window resize and visual-viewport changes update HTML and the two 3D overlays together; no centered 16:9 letterbox remains.

The heading and description are stationary. Mouse movement tilts and translates the bottom statement, while the avatar retains its subtle 3D response. The avatar rotates up to roughly 11.5° horizontally and 5.7° vertically. Pointer exit or loss of focus returns the composition to its resting pose. Reduced motion disables this motion.

During the opening scroll the avatar folds into depth with a corkscrew rotation. The three balls follow staggered arcs, spin and shrink to zero. These transforms are controlled by scroll progress and reverse smoothly; opacity is not used to switch off the models. The ball simulation pauses during this departure.

The original `low+poly+head+3d+model.glb` is untouched. `scripts/prepare-avatar.mjs` creates `public/avatar.glb`, preserving the original colour texture and UVs while simplifying the 1,996,661 triangles to 100,000. The browser copy is 2.64 MB instead of 65.89 MB. Run `node scripts/prepare-avatar.mjs` to rebuild it.

## Social balls

The three supplied X, Pinterest and Behance models rest on the cap-height of the foreground statement. Mouse movement tilts that statement up to 6° left/right, three times the earlier angle. The collider follows the same translation, rotation, font metrics and viewport coordinates as the HTML lettering.

A fixed 120 Hz simulation handles gravity, rolling, ball-to-ball contacts, damped rebounds and off-screen recycling. An impact excites a damped deformation spring: the leather ball flattens, widens slightly and recovers its shape. A fully fallen ball returns above the viewport and drops onto the text again. Simulation sleeps at rest and pauses while the tab or hero is hidden. Reduced motion leaves the balls static.

The original uploads are preserved. Browser copies in `public/ball-*.glb` contain 20,000 triangles each and are approximately 0.8 MB each. Regenerate them with `node scripts/prepare-avatar.mjs <original.glb> <output.glb> 20000`. Run `node scripts/verify-ball-physics.mjs` for the behavior checks.

Hovering any ball shows a blue Anton “OPEN LINK ↗” pill on a translucent grey background with backdrop blur, matching the supplied reference. Its hit area follows the ball's current position and soft deformation; the pill follows along while the ball moves. The same overlay works on Home and contact, hides during the architectural transition, and does not intercept scrolling or the existing mouse response. The pill is visual only while social destinations remain unconfigured.

## Scroll scene

The earlier architectural tunnel remains reachable by scrolling. The new Home text settles before becoming stationary paint on its walls; the avatar and social balls clear before that handoff. The cube, navigation and detailed columns remain removed.

The hall remains an abstract white architectural maquette. Behind the broad colonnade are four rooms with open, extruded arched entrances. The interiors use blue, terracotta, sage and ochre surfaces, overhead illumination calculated in world space, and low monolithic steps to show depth. White surface tones remain close to the page background.

All three text blocks are part of the opaque architecture material. A canvas texture is drawn from the measured DOM line boxes and the same locally bundled Anton font. A fixed projector maps it onto the walls, deep reveals, floor and ceiling. A depth texture captured from the original viewpoint limits the paint to the first visible surfaces, so it does not project through an obstructing wall. These surfaces stay fixed throughout the scroll.

At the starting viewpoint the projection reconstructs the readable HTML composition. After a short reading hold, the HTML and painted version switch in one frame. Moving the camera reveals the lettering stretched along surfaces and around corners. GSAP ScrollTrigger supplies a reversible progress value. The projection is rebuilt after a window resize.

Move the mouse inside the tunnel to look around (up to about 14° horizontally and 8° vertically). The view follows smoothly and recenters when the pointer leaves the page or the window loses focus. Scroll still controls forward/backward travel. Mouse look gradually activates after the opening composition and does not change the stationary wall texture.

Mouse look settles before the final approach. The camera travels to a portfolio wall at the far end of the corridor. That wall uses a canvas drawn from the actual portfolio DOM, including the same font, row positions and generated artwork. Its size and the camera endpoint fit the current viewport. At the matching endpoint the HTML takes over and enables interaction, preserving the composition.

Reduced motion uses static Home, hall and portfolio screens followed by the contact section; the contact balls start at rest. A WebGL failure preserves Home, portfolio and contact as readable HTML.

## Portfolio

The white portfolio contains three original concept studies: Quiet Orbit, Little Listener and Soft Switch. Hover or keyboard focus changes the preview; click or Enter opens an image and project description in a native dialog. Close, Escape, or a backdrop click dismisses it. The row layout follows the supplied Design is Funny reference; Anton remains the site font.

All three preview images are decoded before interaction. A single interruptible GSAP transform moves the preview between rows. Hover does not rebuild the large portfolio wall texture or render the hidden hall; the wall is captured once on reverse scroll. Keyboard navigation between rows and dialog focus restoration preserve the scroll position. The stage uses `overflow: clip` so focus cannot scroll an invisible inner container.

The artwork was generated with the built-in imagegen tool and delivered as local WebP assets (approximately 135–168 KB each). Original PNGs and the complete generation prompts are retained; see `IMAGE-PROMPTS.md`. These are prototype concept projects, with no invented client or award claims.

## Contact and ordinary scrolling

The sticky architectural sequence releases at the portfolio endpoint. Further scrolling moves the portfolio up naturally and reveals a white, full-height contact section. Large Anton lettering reads “Want to reach out?”, with the user-authorized placeholder `hello@example.com` and plain X / Twitter, Pinterest and Behance labels. No social destinations are configured.

The same three models and renderer move into the contact layer. On first entry the balls fall from above, compress and rebound gently, then settle with soft shadows above the social labels. Floor friction and side boundaries keep them in view; they do not recycle. The simulation sleeps at rest, retains its floor state when revisiting the section, and preserves floor contacts on resize. The contact composition shares Home's viewport scale.

## Mobile

Portrait screens up to 767 px use a 720-unit composition scaled to their width. The heading and foreground statement split into two lines, the avatar moves below the description, and the ball collider follows the first visible line of the statement. Small viewport units keep the pinned scene stable when mobile browser chrome moves.

Horizontal dragging on the foreground statement tilts it; horizontal dragging in the tunnel looks around. Vertical gestures keep normal scrolling (`touch-action: pan-y`). Tap a ball to show its pill; another tap or scrolling clears it. Social URLs remain unconfigured.

The tunnel uses a wider field of view and slightly clearer surface shading on portrait phones. The camera endpoint is recalculated from that field of view, retaining the matching handoff to HTML. Mobile renderers cap pixel density at 1.5 and use a smaller projection-depth target.

On mobile the portfolio preview stays above the work list, with readable stacked row details and a single-column project dialog. The contact section preserves large Anton typography and a resting floor for the social balls. Landscape phones use the compact desktop composition.

## Publish

Use Node.js 24 and pnpm. Vercel detects the pnpm lockfile and the Vite framework; `vercel.json` specifies `pnpm build` and the `dist` output directory. All required models, textures and the Anton licence are included in `public`.

The Vercel project is connected to the GitHub repository. Pushing to `main` creates a production deployment.

Original working uploads and local screenshots are kept locally and excluded from Git and deployment. Optimized browser assets and generated portfolio artwork are included. No environment variables or backend are required.

## Reference

The lower website demonstration in [SMLXL's Spatial 2025 case](https://smlxl.company/project/spatial-2025/) was reviewed again, with particular attention to the transition at approximately 2–4 seconds of `Spatial-2025_Vid-22.mp4`.

## Verification

See `VERIFICATION.md` for the current revision. Mobile captures use `v9-`; the hover capture uses `v8-`; `v7-` captures show the white portfolio and contact composition. Local captures are excluded from the public repository.
