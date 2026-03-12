/**
 * Returns true if the current device is a touch/mobile device.
 * Uses navigator.maxTouchPoints which is reliable across modern browsers including iOS Safari.
 */
export function isMobile(): boolean {
  return navigator.maxTouchPoints > 0;
}
