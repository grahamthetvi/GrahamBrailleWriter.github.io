/**
 * Speech strings for Perkins practice: dot numbers in order 1–6, and
 * matching fingers (left pointer→1 … left ring→3, right pointer→4 … right ring→6).
 */

const FINGER_BY_DOT: Record<number, string> = {
    1: 'left pointer',
    2: 'left middle',
    3: 'left ring',
    4: 'right pointer',
    5: 'right middle',
    6: 'right ring',
};

function joinOxford(items: string[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** Dots 1–6 that are active, in ascending order. */
export function getActiveDotNumbers(dots: readonly boolean[]): number[] {
    const out: number[] = [];
    for (let i = 0; i < 6; i++) {
        if (dots[i]) out.push(i + 1);
    }
    return out;
}

export function buildDotsSpeech(active: number[], isSpace: boolean): string {
    if (isSpace) {
        return 'Press the space bar. No letter dots for a space.';
    }
    if (active.length === 0) {
        return 'No dots are defined for this character in the practice map.';
    }
    const listed = joinOxford(active.map(String));
    return `Press dots ${listed} together, all at once.`;
}

export function buildFingersSpeech(active: number[], isSpace: boolean): string {
    if (isSpace) {
        return 'Press the space bar with both thumbs.';
    }
    if (active.length === 0) {
        return 'No finger keys for this character in the practice map.';
    }
    const fingers = active.map((d) => FINGER_BY_DOT[d]);
    const listed = joinOxford(fingers);
    return `Press together: ${listed}.`;
}

export function speakPerkinsHint(text: string): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
}

export function cancelPerkinsSpeech(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}
