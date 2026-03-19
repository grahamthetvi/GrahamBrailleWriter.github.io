import type { Embosser, EmbossingAttributeSet, Rectangle } from './Embosser';
import { GenericTextEmbosser } from './GenericTextEmbosser';

const IndexDuplex = {
    P1ONLY: 1,
    INTERPOINT: 2
} as const;

export class IndexBrailleEmbosser implements Embosser {
    private id: string;
    private model: string;
    private maxPaper: Rectangle;
    private minPaper: Rectangle;
    private maxCellsPerLine: number = 49;

    constructor(id: string, model: string, maxPaper: Rectangle, minPaper: Rectangle) {
        this.id = id;
        this.model = model;
        this.maxPaper = maxPaper;
        this.minPaper = minPaper;
    }

    getId(): string { return this.id; }
    getManufacturer(): string { return 'Index Braille'; }
    getModel(): string { return this.model; }

    getMaximumPaper(): Rectangle { return this.maxPaper; }
    getMinimumPaper(): Rectangle { return this.minPaper; }
    supportsInterpoint(): boolean { return true; }

    generateBytes(brf: string, attributes: EmbossingAttributeSet): Uint8Array {
        const copies = attributes.copies || 1;
        const duplexMode = IndexDuplex.INTERPOINT;
        const bindingMargin = 0;
        const cellsPerLine = this.maxCellsPerLine;
        const topMargin = 0;
        const linesPerPage = 25;

        // Index Braille Escape Sequence Header
        const ESC = '\x1B';
        const headerString = `${ESC}DBT0,LS50,TD0,PN0,MC${copies},DP${duplexMode},BI${bindingMargin},CH${cellsPerLine},TM${topMargin},LP${linesPerPage};`;

        const encoder = new TextEncoder();
        const headerBytes = encoder.encode(headerString);

        // Index relies on standard generic text formatting (CR/LF) and Form Feeds for the body
        const genericEmbosser = new GenericTextEmbosser();
        const bodyBytes = genericEmbosser.generateBytes(brf, attributes);

        // Index footer is 0x1A (Ctrl+Z)
        const footerBytes = new Uint8Array([0x1A]);

        const output = new Uint8Array(headerBytes.length + bodyBytes.length + footerBytes.length);
        output.set(headerBytes);
        output.set(bodyBytes, headerBytes.length);
        output.set(footerBytes, headerBytes.length + bodyBytes.length);

        return output;
    }
}
