import { useState } from 'react';
import { extractDots, asciiToUnicodeBraille } from '../utils/braille';

interface PerkinsViewerProps {
    brfText: string;
}

export function PerkinsViewer({ brfText }: PerkinsViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Filter out any carriage returns or newlines that might be in the raw BRF
    const characters = brfText.replace(/[\r\n]+/g, '').split('');

    const hasContent = characters.length > 0;
    const currentChar = hasContent ? characters[currentIndex] : '';
    const currentUnicode = hasContent ? asciiToUnicodeBraille(currentChar) : '';

    // If it's a space, handle it specifically since extractDots might return all false,
    // but we want to know it's a space for display purposes.
    const isSpace = currentChar === ' ';
    const dots = extractDots(currentUnicode);

    const prevChar = () => {
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    };

    const nextChar = () => {
        if (currentIndex < characters.length - 1) setCurrentIndex(currentIndex + 1);
    };

    if (!hasContent) {
        return (
            <div className="perkins-viewer empty">
                <p>Type in the editor or open a file to use the Perkins Translator.</p>
            </div>
        );
    }

    // Visual layout for standard Perkins Brailler keys
    // Left side: Dot 3, Dot 2, Dot 1
    // Right side: Dot 4, Dot 5, Dot 6
    return (
        <div className="perkins-viewer">
            <div className="perkins-header">
                <h3>Perkins Translator View</h3>
                <p className="perkins-instruction">Step through the document to see which keys to press.</p>
            </div>

            <div className="perkins-current-character-display">
                <span className="perkins-label">Current character:</span>
                <span className="perkins-char">
                    {isSpace ? '[Space]' : currentChar}
                </span>
                <span className="perkins-unicode">{currentUnicode}</span>
            </div>

            <div className="perkins-keyboard-layout">
                <div className="perkins-keys-side left-side">
                    <div className={`perkins-key ${dots[2] ? 'active' : ''}`}><span>Dot 3</span></div>
                    <div className={`perkins-key ${dots[1] ? 'active' : ''}`}><span>Dot 2</span></div>
                    <div className={`perkins-key ${dots[0] ? 'active' : ''}`}><span>Dot 1</span></div>
                </div>

                <div className={`perkins-spacebar ${isSpace ? 'active' : ''}`}>
                    <span>Space</span>
                </div>

                <div className="perkins-keys-side right-side">
                    <div className={`perkins-key ${dots[3] ? 'active' : ''}`}><span>Dot 4</span></div>
                    <div className={`perkins-key ${dots[4] ? 'active' : ''}`}><span>Dot 5</span></div>
                    <div className={`perkins-key ${dots[5] ? 'active' : ''}`}><span>Dot 6</span></div>
                </div>
            </div>

            <div className="perkins-navigation">
                <button
                    className="toolbar-btn"
                    onClick={prevChar}
                    disabled={currentIndex === 0}
                >
                    &larr; Previous
                </button>
                <span className="perkins-progress">
                    Character {currentIndex + 1} of {characters.length}
                </span>
                <button
                    className="toolbar-btn"
                    onClick={nextChar}
                    disabled={currentIndex === characters.length - 1}
                >
                    Next &rarr;
                </button>
            </div>
        </div>
    );
}
