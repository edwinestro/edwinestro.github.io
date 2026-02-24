/* ============================================================
   Charts — Canvas-based charts for HAR analysis
   No external dependencies — pure Canvas 2D rendering
   ============================================================ */

class Charts {
    constructor() {
        this.palette = [
            '#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff',
            '#f778ba', '#39d2c0', '#f0883e', '#a371f7', '#79c0ff',
            '#56d364', '#e3b341', '#8b949e',
        ];
    }

    /**
     * Draw a doughnut chart
     */
    drawDoughnut(canvas, data, options = {}) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        const total = data.reduce((s, d) => s + d.value, 0);
        if (total === 0) {
            this._drawEmpty(ctx, w, h);
            return;
        }

        const cx = w / 2;
        const cy = h / 2 - 10;
        const radius = Math.max(Math.min(cx, cy) - 30, 10);
        const innerRadius = radius * 0.55;
        const labelRadius = radius + 18;

        let angle = -Math.PI / 2;

        data.forEach((d, i) => {
            const sliceAngle = (d.value / total) * Math.PI * 2;
            const color = d.color || this.palette[i % this.palette.length];

            // Draw slice
            ctx.beginPath();
            ctx.arc(cx, cy, radius, angle, angle + sliceAngle);
            ctx.arc(cx, cy, innerRadius, angle + sliceAngle, angle, true);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // Label
            if (d.value / total > 0.04) {
                const midAngle = angle + sliceAngle / 2;
                const lx = cx + Math.cos(midAngle) * labelRadius;
                const ly = cy + Math.sin(midAngle) * labelRadius;
                const pct = ((d.value / total) * 100).toFixed(0);

                ctx.fillStyle = '#e6edf3';
                ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
                ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${d.label} (${pct}%)`, lx, ly);
            }

            angle += sliceAngle;
        });

        // Center text
        ctx.fillStyle = '#8b949e';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Total: ${data.length}`, cx, cy - 6);
        if (options.centerLabel) {
            ctx.fillText(options.centerLabel, cx, cy + 10);
        }
    }

    /**
     * Draw a horizontal bar chart
     */
    drawHorizontalBar(canvas, data, options = {}) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        if (!data.length) {
            this._drawEmpty(ctx, w, h);
            return;
        }

        const maxVal = Math.max(...data.map(d => d.value), 1);
        const barHeight = 22;
        const gap = 6;
        const labelWidth = Math.min(180, w * 0.3);
        const valueWidth = 80;
        const barAreaWidth = Math.max(w - labelWidth - valueWidth - 20, 20);
        const startY = 10;

        data.forEach((d, i) => {
            const y = startY + i * (barHeight + gap);
            const barWidth = (d.value / maxVal) * barAreaWidth;
            const color = d.color || this.palette[i % this.palette.length];

            // Label (truncated)
            ctx.fillStyle = '#8b949e';
            ctx.font = '11px "Cascadia Code", "Consolas", monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const label = this._truncateText(ctx, d.label, labelWidth - 8);
            ctx.fillText(label, labelWidth - 8, y + barHeight / 2);

            // Bar
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(labelWidth, y, Math.max(barWidth, 2), barHeight, 3);
            ctx.fill();

            // Value
            ctx.fillStyle = '#e6edf3';
            ctx.font = '11px "Cascadia Code", "Consolas", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(d.formattedValue || d.value, labelWidth + barWidth + 8, y + barHeight / 2);
        });
    }

    _drawEmpty(ctx, w, h) {
        ctx.fillStyle = '#6e7681';
        ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No data', w / 2, h / 2);
    }

    _truncateText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        while (text.length > 0 && ctx.measureText(text + '…').width > maxWidth) {
            text = text.slice(0, -1);
        }
        return text + '…';
    }

    /* -------- High-level rendering from HarParser -------- */

    renderAll(parser) {
        this.renderTypeChart(parser);
        this.renderSizeChart(parser);
        this.renderStatusChart(parser);
        this.renderSlowestChart(parser);
        this.renderLargestChart(parser);
        this.renderDomainChart(parser);
    }

    renderTypeChart(parser) {
        const canvas = document.getElementById('chart-type');
        if (!canvas) return;
        const groups = parser.getByType();
        const data = Object.entries(groups)
            .map(([label, g], i) => ({ label, value: g.count, color: this.palette[i % this.palette.length] }))
            .sort((a, b) => b.value - a.value);
        this.drawDoughnut(canvas, data, { centerLabel: 'requests' });
    }

    renderSizeChart(parser) {
        const canvas = document.getElementById('chart-size');
        if (!canvas) return;
        const groups = parser.getByType();
        const data = Object.entries(groups)
            .map(([label, g], i) => ({ label, value: g.size, color: this.palette[i % this.palette.length] }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);
        this.drawDoughnut(canvas, data, { centerLabel: HarParser.formatBytes(data.reduce((s, d) => s + d.value, 0)) });
    }

    renderStatusChart(parser) {
        const canvas = document.getElementById('chart-status');
        if (!canvas) return;
        const statusColors = { '2xx': '#3fb950', '3xx': '#d29922', '4xx': '#f85149', '5xx': '#f85149', 'Failed': '#8b949e', '1xx': '#58a6ff' };
        const groups = parser.getByStatus();
        const data = Object.entries(groups)
            .map(([label, g]) => ({ label, value: g.count, color: statusColors[label] || '#58a6ff' }))
            .sort((a, b) => b.value - a.value);
        this.drawDoughnut(canvas, data, { centerLabel: 'responses' });
    }

    renderSlowestChart(parser) {
        const canvas = document.getElementById('chart-slow');
        if (!canvas) return;
        const slowest = parser.getSlowest(10);
        const data = slowest.map((e, i) => ({
            label: e.filename,
            value: e.time,
            formattedValue: HarParser.formatTime(e.time),
            color: this.palette[i % this.palette.length],
        }));
        this.drawHorizontalBar(canvas, data);
    }

    renderLargestChart(parser) {
        const canvas = document.getElementById('chart-large');
        if (!canvas) return;
        const largest = parser.getLargest(10);
        const data = largest.filter(e => e.transferSize > 0).map((e, i) => ({
            label: e.filename,
            value: e.transferSize,
            formattedValue: HarParser.formatBytes(e.transferSize),
            color: this.palette[i % this.palette.length],
        }));
        this.drawHorizontalBar(canvas, data);
    }

    renderDomainChart(parser) {
        const canvas = document.getElementById('chart-domain');
        if (!canvas) return;
        const groups = parser.getByDomain();
        const data = Object.entries(groups)
            .map(([label, g], i) => ({ label, value: g.count, color: this.palette[i % this.palette.length] }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
        this.drawDoughnut(canvas, data, { centerLabel: 'domains' });
    }
}

window.Charts = Charts;
