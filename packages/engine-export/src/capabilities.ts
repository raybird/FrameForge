/** WebCodecs 能力偵測。 */
export function isWebCodecsSupported(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'VideoEncoder' in globalThis &&
    'VideoFrame' in globalThis
  );
}
