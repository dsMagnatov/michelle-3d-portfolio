export const DESIGN = { width: 1920, height: 1080 };

export interface CompositionLayout {
  width: number;
  height: number;
  scale: number;
  logicalWidth: number;
  logicalHeight: number;
  avatarScale: number;
  mobile: boolean;
}

/** One coordinate system for HTML, parallax and the avatar's orthographic camera. */
export function measureComposition(container: HTMLElement): CompositionLayout {
  const bounds = container.getBoundingClientRect();
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const mobile = width <= 767 && height >= width;
  const scale = mobile ? width / 720 : Math.min(width / DESIGN.width, height / DESIGN.height);
  const logicalHeight = height / scale;
  return {
    width, height, scale,
    logicalWidth: width / scale,
    logicalHeight,
    mobile,
    // On very tall/narrow desktop windows, keep the head clear of the left-hand copy.
    avatarScale: mobile
      ? Math.min(logicalHeight * 0.74, Math.max(0, logicalHeight - 520)) / 992
      : Math.min(width, height) / (DESIGN.height * scale),
  };
}
