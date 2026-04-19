import { GridCanvas } from './chartBraille';

export function parseParams(paramString: string): Record<string, string> {
    const params: Record<string, string> = {};
    const regex = /([a-zA-Z0-9_-]+)=([^ \t]+)/g;
    let match;
    while ((match = regex.exec(paramString)) !== null) {
        params[match[1]] = match[2];
    }
    return params;
}

export function renderTactileGraphic(type: string, paramString: string): string {
    const params = parseParams(paramString);
    const width = parseInt(params.width || '30', 10);
    const height = parseInt(params.height || '15', 10);

    const canvas = new GridCanvas(width, height);

    if (type === 'shape') {
        const sides = parseInt(params.sides || '4', 10);
        const radius = parseInt(params.size || '10', 10);
        const angleOffset = parseFloat(params.angle || '0');

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        if (sides < 3) {
            canvas.drawCircle(cx, cy, radius);
        } else {
            const points: { x: number, y: number }[] = [];
            for (let i = 0; i < sides; i++) {
                const angle = angleOffset + (i * 2 * Math.PI) / sides;
                points.push({
                    x: cx + radius * Math.cos(angle),
                    y: cy + radius * Math.sin(angle),
                });
            }
            for (let i = 0; i < sides; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % sides];
                canvas.drawLine(p1.x, p1.y, p2.x, p2.y);
            }
        }
    } else if (type === 'clock') {
        const time = params.time || '12:00';
        const [hoursStr, minutesStr] = time.split(':');
        const hours = parseInt(hoursStr, 10) % 12;
        const minutes = parseInt(minutesStr || '0', 10);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.min(cx, cy) - 2;

        canvas.drawCircle(cx, cy, radius);

        // Draw ticks
        for (let i = 0; i < 12; i++) {
            const angle = (i * 2 * Math.PI) / 12 - Math.PI / 2;
            const r1 = radius - 2;
            const r2 = radius;
            canvas.drawLine(cx + r1 * Math.cos(angle), cy + r1 * Math.sin(angle), cx + r2 * Math.cos(angle), cy + r2 * Math.sin(angle));
        }

        // Minute hand
        const minAngle = (minutes * 2 * Math.PI) / 60 - Math.PI / 2;
        const minLen = radius * 0.8;
        canvas.drawLine(cx, cy, cx + minLen * Math.cos(minAngle), cy + minLen * Math.sin(minAngle));

        // Hour hand
        const hourAngle = ((hours + minutes / 60) * 2 * Math.PI) / 12 - Math.PI / 2;
        const hourLen = radius * 0.5;
        canvas.drawLine(cx, cy, cx + hourLen * Math.cos(hourAngle), cy + hourLen * Math.sin(hourAngle));
    } else if (type === 'fraction') {
        const num = parseInt(params.numerator || '1', 10);
        const den = parseInt(params.denominator || '2', 10);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.min(cx, cy) - 2;

        canvas.drawCircle(cx, cy, radius);

        for (let i = 0; i < den; i++) {
            const angle = (i * 2 * Math.PI) / den - Math.PI / 2;
            canvas.drawLine(cx, cy, cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
        }

        // Fill segments
        for (let i = 0; i < num; i++) {
            const startAngle = (i * 2 * Math.PI) / den - Math.PI / 2;
            const endAngle = ((i + 1) * 2 * Math.PI) / den - Math.PI / 2;
            const midAngle = (startAngle + endAngle) / 2;
            
            // Simple crosshatch for filled segment
            for (let r = 2; r < radius - 2; r += 4) {
                canvas.setPoint(cx + r * Math.cos(midAngle), cy + r * Math.sin(midAngle));
            }
        }
    } else if (type === 'number-line') {
        const min = parseInt(params.min || '0', 10);
        const max = parseInt(params.max || '10', 10);
        const step = parseInt(params.step || '1', 10);

        const cy = canvas.height / 2;
        const padding = 4;
        const lineLen = canvas.width - padding * 2;

        canvas.drawLine(padding, cy, canvas.width - padding, cy);

        const range = max - min;
        const numTicks = Math.floor(range / step);
        
        for (let i = 0; i <= numTicks; i++) {
            const x = padding + (i / numTicks) * lineLen;
            canvas.drawLine(x, cy - 2, x, cy + 2);
        }
    } else if (type === 'base-ten') {
        const value = parseInt(params.value || '123', 10);
        const hundreds = Math.floor(value / 100);
        const tens = Math.floor((value % 100) / 10);
        const ones = value % 10;

        let xOffset = 2;
        const blockH = 10;
        const blockW = 10;

        for (let i = 0; i < hundreds; i++) {
            canvas.drawLine(xOffset, 2, xOffset + blockW, 2);
            canvas.drawLine(xOffset, 2 + blockH, xOffset + blockW, 2 + blockH);
            canvas.drawLine(xOffset, 2, xOffset, 2 + blockH);
            canvas.drawLine(xOffset + blockW, 2, xOffset + blockW, 2 + blockH);
            xOffset += blockW + 4;
        }

        for (let i = 0; i < tens; i++) {
            canvas.drawLine(xOffset, 2, xOffset, 2 + blockH);
            xOffset += 4;
        }

        for (let i = 0; i < ones; i++) {
            canvas.setPoint(xOffset, 2 + blockH);
            xOffset += 4;
        }
    } else {
        return ''; // Unsupported for raw conversion
    }

    return canvas.renderToBRF();
}
