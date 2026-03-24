/**
 * Word-wraps a single braille line to at most `cells` characters.
 *
 * `space` is the word-separator character:
 *   - '\u2800' (U+2800, BRAILLE PATTERN BLANK) for Unicode braille strings
 *   - ' '  (0x20) for raw ASCII BRF strings
 *
 * Words that fit on the current line are appended with a leading space.
 * Words longer than `cells` are hard-broken at the character limit (the only
 * case where a word is split mid-character, matching the user's requirement).
 */
/** 1-based Braille cell index (cell 1 = leftmost). */
export type ParagraphLineStarts = {
  firstLineStartCell: number;
  runoverStartCell: number;
};

function clampParagraphCell(n: number, cellsPerRow: number): number {
  const max = Math.max(1, cellsPerRow);
  return Math.min(max, Math.max(1, Math.floor(n)));
}

/**
 * Word-wraps one logical line with literary paragraph margins: first physical line
 * starts at `firstLineStartCell`, continuation lines at `runoverStartCell` (1-based).
 * Each output line is prefix blanks + content, total width at most `cellsPerRow`.
 */
export function wrapBrailleLineWithParagraphStarts(
  line: string,
  cellsPerRow: number,
  firstLineStartCell: number,
  runoverStartCell: number,
  space: string,
): string[] {
  const cells = Math.max(1, cellsPerRow);
  const firstCell = clampParagraphCell(firstLineStartCell, cells);
  const runCell = clampParagraphCell(runoverStartCell, cells);
  const marginFirst = firstCell - 1;
  const marginRun = runCell - 1;
  const capFirst = Math.max(1, cells - marginFirst);
  const capRun = Math.max(1, cells - marginRun);

  const words = line.split(space);
  const result: string[] = [];
  let current = '';
  let onFirstLine = true;

  const margin = () => (onFirstLine ? marginFirst : marginRun);
  const cap = () => (onFirstLine ? capFirst : capRun);

  const pushCurrent = () => {
    if (current.length === 0) return;
    const m = margin();
    result.push(space.repeat(m) + current);
    current = '';
    onFirstLine = false;
  };

  for (const word of words) {
    if (word.length === 0) continue;

    if (word.length > cap()) {
      if (current.length > 0) pushCurrent();
      let remaining = word;
      while (remaining.length > 0) {
        const c = cap();
        const chunk = remaining.slice(0, c);
        remaining = remaining.slice(c);
        const m = margin();
        result.push(space.repeat(m) + chunk);
        onFirstLine = false;
      }
      continue;
    }

    const needed =
      current.length === 0 ? word.length : current.length + space.length + word.length;
    if (needed <= cap()) {
      current = current.length === 0 ? word : current + space + word;
    } else {
      pushCurrent();
      current = word;
    }
  }
  pushCurrent();
  return result;
}

function wrapBrailleLine(line: string, cells: number, space: string): string[] {
  const words = line.split(space);
  const result: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length === 0) continue; // skip empty segments (consecutive spaces)

    if (word.length > cells) {
      // Single word exceeds a full row — hard-break at the character limit
      if (current.length > 0) {
        result.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += cells) {
        const chunk = word.slice(i, i + cells);
        if (chunk.length === cells) {
          result.push(chunk);
        } else {
          current = chunk; // final partial chunk continues on next line
        }
      }
    } else {
      // Normal word — does it fit on the current line?
      const needed = current.length === 0
        ? word.length
        : current.length + 1 + word.length; // +1 for the space separator
      if (needed <= cells) {
        current = current.length === 0 ? word : current + space + word;
      } else {
        if (current.length > 0) result.push(current);
        current = word;
      }
    }
  }

  if (current.length > 0) result.push(current);
  return result;
}

/**
 * Converts a page number to ASCII braille notation (North American).
 * e.g. 1 -> '#a', 10 -> '#aj'
 */
function toBrailleNumber(num: number): string {
  let chars = '#';
  const s = num.toString();
  for (const c of s) {
    if (c === '0') chars += 'j';
    else chars += String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 10) - 1);
  }
  return chars;
}

/**
 * Formats a Unicode braille string into an array of page strings for display.
 * Each page contains at most linesPerPage lines; each line is at most cellsPerRow
 * characters wide. Lines that exceed cellsPerRow are word-wrapped — whole braille
 * words move to the next line. Only words longer than cellsPerRow are hard-broken.
 */
export function formatBrfPages(
  unicodeBraille: string,
  cellsPerRow: number,
  linesPerPage: number,
  includePageNumbers: boolean = false,
  paragraphStarts?: ParagraphLineStarts,
): string[] {
  const cells = Math.max(1, cellsPerRow);
  const lines = Math.max(1, linesPerPage);

  // In Unicode braille, ASCII space (0x20) was converted to U+2800 (blank braille pattern)
  const BRAILLE_SPACE = '\u2800';

  const firstStart = paragraphStarts?.firstLineStartCell ?? 1;
  const runStart = paragraphStarts?.runoverStartCell ?? 1;
  const useParagraphStarts = firstStart > 1 || runStart > 1;

  const rawLines = unicodeBraille.split('\n');
  const wrappedLines: string[] = [];

  for (const line of rawLines) {
    if (line.length === 0) {
      wrappedLines.push(''); // preserve blank lines (e.g. from Enter key presses)
    } else if (useParagraphStarts) {
      wrappedLines.push(
        ...wrapBrailleLineWithParagraphStarts(line, cells, firstStart, runStart, BRAILLE_SPACE),
      );
    } else if (line.length <= cells) {
      wrappedLines.push(line); // fits — no wrapping needed
    } else {
      wrappedLines.push(...wrapBrailleLine(line, cells, BRAILLE_SPACE));
    }
  }

  // Trim trailing blank lines so the last page isn't mostly empty
  while (wrappedLines.length > 0 && wrappedLines[wrappedLines.length - 1] === '') {
    wrappedLines.pop();
  }

  if (wrappedLines.length === 0) return [''];

  const pages: string[] = [];
  const contentLines = includePageNumbers ? Math.max(1, lines - 1) : lines;

  for (let i = 0; i < wrappedLines.length; i += contentLines) {
    const chunk = wrappedLines.slice(i, i + contentLines);
    if (includePageNumbers) {
      // Pad to standard size so page number goes to the bottom
      while (chunk.length < contentLines) {
        chunk.push('');
      }
      const pageNumStr = toBrailleNumber(Math.floor(i / contentLines) + 1);
      const unicodePageNum = pageNumStr.split('').map(c => String.fromCharCode(c.charCodeAt(0) - 0x20 + 0x2800)).join('');
      chunk.push(unicodePageNum.padStart(cells, BRAILLE_SPACE));
    }
    pages.push(chunk.join('\n'));
  }
  return pages;
}

/**
 * Normalizes a BRF file read as text: CRLF → LF, form feeds → blank line (page gap).
 */
export function normalizeImportedBrf(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\f/g, '\n\n');
}

/** Default download name; includes time so same-day exports do not overwrite in the browser. */
export function defaultBrfDownloadFilename(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `braille-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.brf`;
}

/**
 * Formats raw ASCII BRF for download / embosser printing.
 * Hard-wraps at cellsPerRow using word-aware wrapping, paginates with
 * form-feed characters (0x0C), and uses CRLF line endings as required
 * by most embosser drivers.
 */
export function formatBrfForOutput(
  rawBrf: string,
  cellsPerRow: number,
  linesPerPage: number,
  includePageNumbers: boolean = false,
  paragraphStarts?: ParagraphLineStarts,
): string {
  const cells = Math.max(1, cellsPerRow);
  const lines = Math.max(1, linesPerPage);

  const firstStart = paragraphStarts?.firstLineStartCell ?? 1;
  const runStart = paragraphStarts?.runoverStartCell ?? 1;
  const useParagraphStarts = firstStart > 1 || runStart > 1;

  const rawLines = rawBrf.split('\n');
  const wrapped: string[] = [];

  for (const line of rawLines) {
    if (!line) {
      wrapped.push('');
      continue;
    }
    if (useParagraphStarts) {
      wrapped.push(...wrapBrailleLineWithParagraphStarts(line, cells, firstStart, runStart, ' '));
    } else if (line.length <= cells) {
      wrapped.push(line);
    } else {
      wrapped.push(...wrapBrailleLine(line, cells, ' '));
    }
  }

  // Trim trailing blank lines
  while (wrapped.length > 0 && wrapped[wrapped.length - 1] === '') {
    wrapped.pop();
  }

  const pageChunks: string[] = [];
  const contentLines = includePageNumbers ? Math.max(1, lines - 1) : lines;

  for (let i = 0; i < wrapped.length; i += contentLines) {
    const chunk = wrapped.slice(i, i + contentLines);
    if (includePageNumbers) {
      // Pad to standard size so page number goes to the bottom
      while (chunk.length < contentLines) {
        chunk.push('');
      }
      const pageNumStr = toBrailleNumber(Math.floor(i / contentLines) + 1);
      chunk.push(pageNumStr.padStart(cells, ' '));
    }
    pageChunks.push(chunk.join('\r\n'));
  }

  // Join pages with form feed; add trailing CRLF
  return pageChunks.join('\r\n\f') + '\r\n';
}
