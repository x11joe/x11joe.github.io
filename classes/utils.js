export class Utils {
    /**
     * Copies the given text to the clipboard and applies a glow effect to the element.
     * An optional glowColor (e.g. "yellow") can be provided.
     * @param {HTMLElement} element - The element to apply the glow effect.
     * @param {string} text - The text to copy.
     * @param {string} [glowColor='#00ff00'] - Optional CSS color for the glow effect.
     */
    static copyWithGlow(element, text, glowColor = '#00ff00') {
      navigator.clipboard.writeText(text).then(() => {
        element.style.boxShadow = `0 0 5px ${glowColor}`;
        setTimeout(() => {
          element.style.boxShadow = "";
        }, 500);
      });
    }
}
  