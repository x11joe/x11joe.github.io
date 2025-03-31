export class Utils {
    /**
     * Copies the provided text to the clipboard, then applies a glow effect to the element.
     * Optionally, a glow color can be provided (default is green).
     * @param {HTMLElement} element - The element to apply the glow effect.
     * @param {string} text - The text to copy.
     * @param {string} [glowColor="#00ff00"] - Optional CSS color value for the glow.
     */
    static copyWithGlow(element, text, glowColor = "#00ff00") {
      navigator.clipboard.writeText(text).then(() => {
        element.classList.add('glow');
        const originalBoxShadow = element.style.boxShadow;
        element.style.boxShadow = `0 0 5px ${glowColor}`;
        setTimeout(() => {
          element.classList.remove('glow');
          element.style.boxShadow = originalBoxShadow;
        }, 500);
      });
    }
  }
  