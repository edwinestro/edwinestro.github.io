/* ============================================================
   Waterfall Chart — Renders timing waterfall bars
   ============================================================ */

class WaterfallChart {
    constructor() {
        this.colors = {
            blocked: '#a371f7',
            dns:     '#3fb950',
            connect: '#f0883e',
            ssl:     '#db61a2',
            send:    '#58a6ff',
            wait:    '#d29922',
            receive: '#39d2c0',
        };
    }

    /**
     * Render a waterfall bar for a single entry within a container element.
     * @param {Object} entry - Parsed HAR entry
     * @param {number} globalStart - Earliest request start time (ms timestamp)
     * @param {number} globalDuration - Total time range (ms)
     * @returns {HTMLElement} - The waterfall bar container
     */
    renderBar(entry, globalStart, globalDuration) {
        const container = document.createElement('div');
        container.className = 'waterfall-bar-container';

        if (globalDuration <= 0) return container;

        const entryStart = entry.startedDateTime.getTime();
        const offsetPct = ((entryStart - globalStart) / globalDuration) * 100;

        const timings = entry.timings;
        const segments = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'];
        let currentPct = offsetPct;

        for (const seg of segments) {
            const ms = timings[seg];
            if (ms <= 0) continue;

            const widthPct = (ms / globalDuration) * 100;
            const el = document.createElement('div');
            el.className = 'waterfall-segment';
            el.style.left = currentPct + '%';
            el.style.width = Math.max(widthPct, 0.2) + '%';
            el.style.backgroundColor = this.colors[seg];
            el.title = `${seg}: ${HarParser.formatTimePrecise(ms)}`;
            container.appendChild(el);

            currentPct += widthPct;
        }

        return container;
    }

    /**
     * Render timing breakdown for the detail panel
     * @param {Object} entry - parsed HAR entry
     * @returns {HTMLElement}
     */
    renderTimingDetail(entry) {
        const wrap = document.createElement('div');
        wrap.className = 'timing-bar-chart';

        const timings = entry.timings;
        const segments = [
            { key: 'blocked', label: 'Blocked' },
            { key: 'dns',     label: 'DNS' },
            { key: 'connect', label: 'Connect' },
            { key: 'ssl',     label: 'SSL/TLS' },
            { key: 'send',    label: 'Send' },
            { key: 'wait',    label: 'Wait (TTFB)' },
            { key: 'receive', label: 'Receive' },
        ];

        const total = segments.reduce((s, seg) => s + Math.max(timings[seg.key], 0), 0);
        const maxVal = Math.max(...segments.map(s => timings[s.key]), 1);

        for (const seg of segments) {
            const ms = timings[seg.key];

            const row = document.createElement('div');
            row.className = 'timing-row';

            const label = document.createElement('div');
            label.className = 'timing-label';
            label.textContent = seg.label;

            const track = document.createElement('div');
            track.className = 'timing-bar-track';

            const fill = document.createElement('div');
            fill.className = 'timing-bar-fill';
            fill.style.width = (ms > 0 ? (ms / maxVal) * 100 : 0) + '%';
            fill.style.backgroundColor = this.colors[seg.key];
            track.appendChild(fill);

            const val = document.createElement('div');
            val.className = 'timing-value';
            val.textContent = HarParser.formatTimePrecise(ms);

            row.append(label, track, val);
            wrap.appendChild(row);
        }

        // Total
        const totalRow = document.createElement('div');
        totalRow.className = 'timing-total';
        totalRow.innerHTML = `<span>Total</span><span>${HarParser.formatTimePrecise(total)}</span>`;
        wrap.appendChild(totalRow);

        return wrap;
    }

    /**
     * Get legend HTML
     */
    renderLegend() {
        const wrap = document.createElement('div');
        wrap.className = 'waterfall-legend';
        const segments = [
            { key: 'blocked', label: 'Blocked' },
            { key: 'dns',     label: 'DNS' },
            { key: 'connect', label: 'Connect' },
            { key: 'ssl',     label: 'SSL/TLS' },
            { key: 'send',    label: 'Sending' },
            { key: 'wait',    label: 'Waiting (TTFB)' },
            { key: 'receive', label: 'Receiving' },
        ];
        for (const s of segments) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `<span class="legend-swatch" style="background:${this.colors[s.key]}"></span>${s.label}`;
            wrap.appendChild(item);
        }
        return wrap;
    }
}

window.WaterfallChart = WaterfallChart;
