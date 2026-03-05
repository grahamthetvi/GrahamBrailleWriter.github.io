/**
 * Maps standard ASCII characters to an array of 8 booleans representing
 * the active dots on a Perkins Brailler.
 * Dots [1, 2, 3, 4, 5, 6, 7, 8].
 * This is a static lookup for Grade 1 (uncontracted) braille, meant for
 * educational spelling visualization.
 */

// We use 8 booleans even though Perkins is 6 dots, for compatibility
// with the existing extractDots() return signature if needed elsewhere.
type DotArray = [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean];

const STATIC_BRAILLE_MAP: Record<string, DotArray> = {
    // Letters
    'a': [true, false, false, false, false, false, false, false],  // 1
    'b': [true, true, false, false, false, false, false, false],   // 1, 2
    'c': [true, false, false, true, false, false, false, false],   // 1, 4
    'd': [true, false, false, true, true, false, false, false],    // 1, 4, 5
    'e': [true, false, false, false, true, false, false, false],   // 1, 5
    'f': [true, true, false, true, false, false, false, false],    // 1, 2, 4
    'g': [true, true, false, true, true, false, false, false],     // 1, 2, 4, 5
    'h': [true, true, false, false, true, false, false, false],    // 1, 2, 5
    'i': [false, true, false, true, false, false, false, false],   // 2, 4
    'j': [false, true, false, true, true, false, false, false],    // 2, 4, 5
    'k': [true, false, true, false, false, false, false, false],   // 1, 3
    'l': [true, true, true, false, false, false, false, false],    // 1, 2, 3
    'm': [true, false, true, true, false, false, false, false],    // 1, 3, 4
    'n': [true, false, true, true, true, false, false, false],     // 1, 3, 4, 5
    'o': [true, false, true, false, true, false, false, false],    // 1, 3, 5
    'p': [true, true, true, true, false, false, false, false],     // 1, 2, 3, 4
    'q': [true, true, true, true, true, false, false, false],      // 1, 2, 3, 4, 5
    'r': [true, true, true, false, true, false, false, false],     // 1, 2, 3, 5
    's': [false, true, true, true, false, false, false, false],    // 2, 3, 4
    't': [false, true, true, true, true, false, false, false],     // 2, 3, 4, 5
    'u': [true, false, true, false, false, true, false, false],    // 1, 3, 6
    'v': [true, true, true, false, false, true, false, false],     // 1, 2, 3, 6
    'w': [false, true, false, true, true, true, false, false],     // 2, 4, 5, 6
    'x': [true, false, true, true, false, true, false, false],     // 1, 3, 4, 6
    'y': [true, false, true, true, true, true, false, false],      // 1, 3, 4, 5, 6
    'z': [true, false, true, false, true, true, false, false],     // 1, 3, 5, 6

    // Numbers (Nemeth/Standard Grade 1 digits drop without indicators)
    // Usually numbers require a numeric indicator (dots 3,4,5,6) beforehand.
    // For standard visualization, we just map 1-0 to a-j, but dropped to the bottom of the cell (Dots 2-6) in Nemeth,
    // or top of the cell in standard literary braille. We'll use the top cell standard a-j mapping here:
    '1': [true, false, false, false, false, false, false, false],  // a
    '2': [true, true, false, false, false, false, false, false],   // b
    '3': [true, false, false, true, false, false, false, false],   // c
    '4': [true, false, false, true, true, false, false, false],    // d
    '5': [true, false, false, false, true, false, false, false],   // e
    '6': [true, true, false, true, false, false, false, false],    // f
    '7': [true, true, false, true, true, false, false, false],     // g
    '8': [true, true, false, false, true, false, false, false],    // h
    '9': [false, true, false, true, false, false, false, false],   // i
    '0': [false, true, false, true, true, false, false, false],    // j

    // Common Punctuation
    '.': [false, true, false, false, true, true, false, false],    // 2, 5, 6
    ',': [false, true, false, false, false, false, false, false],  // 2
    ';': [false, true, true, false, false, false, false, false],   // 2, 3
    ':': [false, true, false, false, true, false, false, false],   // 2, 5
    '!': [false, true, true, false, true, false, false, false],    // 2, 3, 5
    '?': [false, true, true, false, false, true, false, false],    // 2, 3, 6
    '-': [false, false, true, false, false, true, false, false],   // 3, 6
    '\'': [false, false, true, false, false, false, false, false], // 3
    '"': [false, true, true, false, false, true, false, false],    // 2, 3, 6 (Same as ?)
    '(': [false, true, true, false, true, true, false, false],     // 2, 3, 5, 6
    ')': [false, true, true, false, true, true, false, false],     // 2, 3, 5, 6
    '/': [false, false, true, true, false, false, false, false],   // 3, 4
};

export const getStaticDots = (char: string): DotArray => {
    const normalized = char.toLowerCase();
    if (STATIC_BRAILLE_MAP[normalized]) {
        return STATIC_BRAILLE_MAP[normalized];
    }
    // Fallback to empty dots if char isn't found
    return [false, false, false, false, false, false, false, false];
};
