/** Whether a slide is the active one or a neighbour, counting across the loop seam. */
export function isNearSlide(index: number, activeIndex: number, slideCount: number) {
  const distance = Math.abs(index - activeIndex);
  return Math.min(distance, slideCount - distance) <= 1;
}
