import type { Embosser, EmbossingAttributeSet, Rectangle } from './Embosser';
import { GenericTextEmbosser } from './GenericTextEmbosser';

export class BrailloEmbosser implements Embosser {
    private id: string;
    private model: string;
    private maxPaper: Rectangle;
    private minPaper: Rectangle;
    private supportsInter: boolean;

    constructor(id: string, model: string, maxPaper: Rectangle, minPaper: Rectangle, supportsInter: boolean = true) {
        this.id = id;
        this.model = model;
        this.maxPaper = maxPaper;
        this.minPaper = minPaper;
        this.supportsInter = supportsInter;
    }

    getId(): string { return this.id; }
    getManufacturer(): string { return 'Braillo'; }
    getModel(): string { return this.model; }

    getMaximumPaper(): Rectangle { return this.maxPaper; }
    getMinimumPaper(): Rectangle { return this.minPaper; }
    supportsInterpoint(): boolean { return this.supportsInter; }

    generateBytes(brf: string, attributes: EmbossingAttributeSet): Uint8Array {
        const interpoint = this.supportsInterpoint() ? 1 : 0;
        const zfolding = 0; // Defaulting to no Z-Folding

        // Braillo expects sheet length in half-inches
        const sheetLengthInches = 11.0;
        const sheetLengthValue = Math.ceil(sheetLengthInches * 2);

        const cellsPerLine = 40;

        // Format: \u001bS1\u001bJ0\u001bN0\u001bR0\u001bA[length]\u001bB[cells]\u001bC[interpoint]\u001bH[zfold]
        const ASC_ESC = '\x1B';
        const aVal = sheetLengthValue.toString().padStart(2, '0');
        const bVal = cellsPerLine.toString().padStart(2, '0');

        const headerString = `${ASC_ESC}S1${ASC_ESC}J0${ASC_ESC}N0${ASC_ESC}R0${ASC_ESC}A${aVal}${ASC_ESC}B${bVal}${ASC_ESC}C${interpoint}${ASC_ESC}H${zfolding}`;

        const encoder = new TextEncoder();
        const headerBytes = encoder.encode(headerString);

        // Braillo body formatting identical to GenericText (CR LF FF)
        const genericEmbosser = new GenericTextEmbosser();
        const bodyBytes = genericEmbosser.generateBytes(brf, attributes);

        const output = new Uint8Array(headerBytes.length + bodyBytes.length);
        output.set(headerBytes);
        output.set(bodyBytes, headerBytes.length);

        return output;
    }
}
