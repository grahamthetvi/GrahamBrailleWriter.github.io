/**
 * TableSelector — dropdown for choosing a liblouis braille translation table.
 *
 * Tables are grouped by language family.  Only tables whose .ctb/.utb files
 * are shipped in public/tables/ are listed; on-demand loading means clicking
 * an unfamiliar table will simply fetch the file at translation time.
 *
 * The component is intentionally a thin wrapper around a <select> so it
 * remains keyboard-accessible and screen-reader friendly without any extra
 * dependency.
 */

import type { BrailleTable } from '../hooks/useBraille';

// ─── Table catalogue ──────────────────────────────────────────────────────────

interface TableEntry {
  file: BrailleTable;
  label: string;
}

interface TableGroup {
  group: string;
  tables: TableEntry[];
}

const TABLE_CATALOGUE: TableGroup[] = [
  {
    group: 'English — UEB (recommended)',
    tables: [
      { file: 'en-ueb-g2.ctb', label: 'UEB Grade 2 (contracted)' },
      { file: 'en-ueb-g1.ctb', label: 'UEB Grade 1 (uncontracted)' },
      { file: 'en-ueb-math.ctb', label: 'UEB Math / Science' },
    ],
  },
  {
    group: 'English — US Legacy',
    tables: [
      { file: 'en-us-g2.ctb',   label: 'US Grade 2 (contracted)' },
      { file: 'en-us-g1.ctb',   label: 'US Grade 1 (uncontracted)' },
      { file: 'en-us-comp8.ctb', label: 'US Computer (8-dot)' },
      { file: 'en-us-comp6.ctb', label: 'US Computer (6-dot)' },
    ],
  },
  {
    group: 'English — British',
    tables: [
      { file: 'en-GB-g2.ctb',  label: 'UK Grade 2 (contracted)' },
      { file: 'en-gb-g1.utb',  label: 'UK Grade 1 (uncontracted)' },
      { file: 'en-gb-comp8.ctb', label: 'UK Computer (8-dot)' },
    ],
  },
  {
    group: 'English — Other',
    tables: [
      { file: 'en-in-g1.ctb',  label: 'Indian English Grade 1' },
      { file: 'UEBC-g2.ctb',   label: 'UEBC Grade 2' },
      { file: 'UEBC-g1.utb',   label: 'UEBC Grade 1' },
    ],
  },
  {
    group: 'French',
    tables: [
      { file: 'Fr-Fr-g2.ctb',  label: 'French (France) Grade 2' },
      { file: 'Fr-Ca-g2.ctb',  label: 'French (Canada) Grade 2' },
    ],
  },
  {
    group: 'Spanish',
    tables: [
      { file: 'Es-Es-g1.ctb',  label: 'Spanish (Spain) Grade 1' },
      { file: 'Es-Es-G0.utb',  label: 'Spanish (Spain) Grade 0' },
    ],
  },
  {
    group: 'German',
    tables: [
      { file: 'de-g2.ctb',     label: 'German Grade 2 (Kurzschrift)' },
      { file: 'de-g1.ctb',     label: 'German Grade 1' },
    ],
  },
  {
    group: 'Other Languages',
    tables: [
      { file: 'ar-ar-g1.utb',  label: 'Arabic Grade 1' },
      { file: 'Se-Se-g1.utb',  label: 'Swedish Grade 1' },
      { file: 'Pl-Pl-g1.utb',  label: 'Polish Grade 1' },
      { file: 'Cz-Cz-g1.utb',  label: 'Czech Grade 1' },
      { file: 'Lv-Lv-g1.utb',  label: 'Latvian Grade 1' },
      { file: 'IPA.utb',        label: 'IPA (International Phonetic Alphabet)' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface TableSelectorProps {
  value: BrailleTable;
  onChange: (table: BrailleTable) => void;
  disabled?: boolean;
}

export function TableSelector({ value, onChange, disabled = false }: TableSelectorProps) {
  return (
    <div className="table-selector">
      <label htmlFor="braille-table-select" className="table-selector__label">
        Table
      </label>
      <select
        id="braille-table-select"
        className="table-selector__select"
        value={value}
        onChange={(e) => onChange(e.target.value as BrailleTable)}
        disabled={disabled}
        title="Select a liblouis braille translation table"
      >
        {TABLE_CATALOGUE.map(({ group, tables }) => (
          <optgroup key={group} label={group}>
            {tables.map(({ file, label }) => (
              <option key={file} value={file}>
                {label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
