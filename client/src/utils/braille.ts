/**
 * Maps standard North American ASCII Braille (BRF) characters to Unicode Braille patterns.
 * ASCII range: 0x20 to 0x5F (Space to Underscore)
 * Unicode range: U+2800 to U+283F
 */
export function asciiToUnicodeBraille(asciiString: string): string {
    // Standard 64-character BRF table mapped to Unicode dot combinations 0-63
    const brfMap = " A1B'K2L@CIF/MSP\\\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&*:4\\\\Z7(_?W]#Y)=";

    let unicodeStr = "";
    for (let i = 0; i < asciiString.length; i++) {
        const char = asciiString.charAt(i).toUpperCase();
        const mapIndex = brfMap.indexOf(char);

        if (mapIndex !== -1) {
            // 0x2800 is the base for Unicode Braille patterns (empty cell)
            unicodeStr += String.fromCharCode(0x2800 + mapIndex);
        } else {
            // If character is not in the BRF set (e.g., newlines), leave it as is
            unicodeStr += asciiString.charAt(i);
        }
    }
    return unicodeStr;
}
