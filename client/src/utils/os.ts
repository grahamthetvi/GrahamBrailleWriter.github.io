/**
 * Operating System and Environment utilities.
 */

export function isChromeOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /CrOS/.test(navigator.userAgent);
}

export function supportsWebUSB(): boolean {
    if (typeof navigator === 'undefined') return false;
    return 'usb' in navigator;
}

/**
 * Returns true if the current environment is a Chromebook
 * and WebUSB is supported by the browser.
 */
export function canUseWebUSB(): boolean {
    return isChromeOS() && supportsWebUSB();
}
