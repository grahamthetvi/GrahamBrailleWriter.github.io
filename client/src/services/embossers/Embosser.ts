export interface Rectangle {
    width: number;
    height: number;
}

export interface EmbossingAttributeSet {
    copies?: number;
    // Options we extract from BrailleBlaster settings
    /** ViewPlus: blank cells prefixed to each line (single-sheet / left alignment). */
    viewPlusLeftPadCells?: number;
}

export interface Embosser {
    getId(): string;
    getManufacturer(): string;
    getModel(): string;

    /**
     * Generates the proprietary byte sequence for the embosser.
     * Takes the raw BRF string and formatting attributes.
     * Returns a Uint8Array of the bytes to be sent over WebUSB/Bridge.
     */
    generateBytes(brf: string, attributes: EmbossingAttributeSet): Uint8Array;

    getMaximumPaper(): Rectangle;
    getMinimumPaper(): Rectangle;
    supportsInterpoint(): boolean;
}
