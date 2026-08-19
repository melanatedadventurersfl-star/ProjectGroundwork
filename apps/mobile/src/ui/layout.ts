export const layout = {
  contentMaxWidth: 760,
  compactBreakpoint: 360,
  tabletBreakpoint: 768,
  minTouchTarget: 44,
  navTouchTarget: 48,
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
} as const;

export function horizontalGutter(width: number) {
  if (width < layout.compactBreakpoint) return 14;
  if (width >= layout.tabletBreakpoint) return 24;
  return 18;
}

export function responsiveContentWidth(width: number) {
  const gutter = horizontalGutter(width);
  return Math.min(layout.contentMaxWidth, Math.max(0, width - gutter * 2));
}
