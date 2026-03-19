import type { Embosser, EmbossingAttributeSet, Rectangle } from './Embosser';

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
     * For generic text embossers, the biggest issue is ensuring the text is formatted 
     * exactly with proper line breaks (`\r\n`) and page breaks (`\f` or Form Feed).
     * Often, if a document "only prints one line", it's missing CR/LF line terminators.
     */
    generateBytes(brf: string, _attributes: EmbossingAttributeSet): Uint8Array {
        // 1. Ensure all lines end with \r\n (Carriage Return + Line Feed)
        const lines = brf.split(/\r?\n/);

        // Default page settings
        const _charsPerLine = 40;
        const linesPerPage = 25;

        let formattedBrf = '';

        for (let i = 0; i < lines.length; i++) {
            formattedBrf += lines[i] + '\r\n'; // CR LF is required by most basic printers

            // Page Break Injection (Form Feed)
            if ((i + 1) % linesPerPage === 0) {
                formattedBrf += '\f'; // \x0C Form Feed character to start a new page
            }
        }

        // Final page break to ensure printer ejects the last page
        if (!formattedBrf.endsWith('\f')) {
            formattedBrf += '\f';
        }

        const encoder = new TextEncoder();
        return encoder.encode(formattedBrf);
    }
}
