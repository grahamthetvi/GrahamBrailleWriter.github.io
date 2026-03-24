import type { Embosser, EmbossingAttributeSet, Rectangle } from './Embosser';
import { formatBrfForOutput } from '../../utils/brailleFormat';

export class GenericTextEmbosser implements Embosser {
    private id: string;
    private manufacturer: string;
    private model: string;

    constructor(id: string = 'generic-text', manufacturer: string = 'Generic', model: string = 'Text Embosser') {
        this.id = id;
        this.manufacturer = manufacturer;
        this.model = model;
    }

    getId(): string { return this.id; }
    getManufacturer(): string { return this.manufacturer; }
    getModel(): string { return this.model; }

    getMaximumPaper(): Rectangle { return { width: 300, height: 300 }; }
    getMinimumPaper(): Rectangle { return { width: 0, height: 0 }; }
    supportsInterpoint(): boolean { return false; }

    /**
     * Formats the raw BRF using the user's selected page dimensions to ensure
     * correct line wrapping and form feeds (\f) for basic printers like ViewPlus.
     */
    generateBytes(brf: string, attributes: EmbossingAttributeSet): Uint8Array {
        const cells = attributes.cellsPerRow ?? 40;
        const lines = attributes.linesPerPage ?? 25;
        const showNumbers = attributes.showPageNumbers ?? false;
        const margin = attributes.leftMargin ?? 0;
        
        const formattedBrf = formatBrfForOutput(brf, cells, lines, showNumbers, margin);
        const encoder = new TextEncoder();
        return encoder.encode(formattedBrf);
    }
}
