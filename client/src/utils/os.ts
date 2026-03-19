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

export function isMac(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Mac/.test(navigator.userAgent);
}

export function isWindows(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Win/.test(navigator.userAgent);
}

export function isLinux(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Linux/.test(navigator.userAgent) && !isChromeOS();
}
