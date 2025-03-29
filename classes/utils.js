export class Utils {
    static copyWithGlow(element, text) {
        navigator.clipboard.writeText(text).then(() => {
            element.classList.add('glow');
            setTimeout(() => element.classList.remove('glow'), 500);
        });
    }
}