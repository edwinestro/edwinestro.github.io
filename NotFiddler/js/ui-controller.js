/* ============================================================
   UI Controller — Manages DOM, events, and rendering
   ============================================================ */

class UIController {
    constructor() {
        this.parser = new HarParser();
        this.waterfall = new WaterfallChart();
        this.charts = new Charts();

        this.filteredEntries = [];
        this.selectedEntry = null;
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.errorsOnly = false;
        this.sortField = null;
        this.sortDir = 'asc';
        this.currentView = 'waterfall';

        this._cacheDOM();
        this._bindEvents();
    }

    /* -------- DOM Caching -------- */

    _cacheDOM() {
        this.els = {
            landing:        document.getElementById('landing-screen'),
            app:            document.getElementById('app-screen'),
            dropOverlay:    document.getElementById('drop-overlay'),
            uploadArea:     document.getElementById('upload-area'),
            fileInput:      document.getElementById('file-input'),
            loadDemoBtn:    document.getElementById('load-demo-btn'),
            fileName:       document.getElementById('file-name'),
            newFileBtn:     document.getElementById('new-file-btn'),
            exportBtn:      document.getElementById('export-btn'),

            // Stats
            statRequests:   document.getElementById('stat-requests'),
            statTransferred:document.getElementById('stat-transferred'),
            statLoadTime:   document.getElementById('stat-load-time'),
            statDomains:    document.getElementById('stat-domains'),
            statErrors:     document.getElementById('stat-errors'),

            // Toolbar
            searchInput:    document.getElementById('search-input'),
            searchClear:    document.getElementById('search-clear'),
            errorsOnlyToggle: document.getElementById('toggle-errors-only'),

            // Views
            waterfallView: document.getElementById('waterfall-view'),
            chartView:     document.getElementById('chart-view'),

            // Table
            requestList:   document.getElementById('request-list'),

            // Detail
            detailPanel:   document.getElementById('detail-panel'),
            detailClose:   document.getElementById('detail-close'),
            detailHeaders: document.getElementById('detail-headers'),
            detailRequest: document.getElementById('detail-request'),
            detailResponse:document.getElementById('detail-response'),
            detailCookies: document.getElementById('detail-cookies'),
            detailTiming:  document.getElementById('detail-timing'),
        };
    }

    /* -------- Event Binding -------- */

    _bindEvents() {
        // File upload via click
        this.els.uploadArea.addEventListener('click', () => this.els.fileInput.click());
        this.els.fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) this._loadFile(e.target.files[0]);
        });

        // Drag & drop on upload area
        this.els.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.els.uploadArea.classList.add('drag-over');
        });
        this.els.uploadArea.addEventListener('dragleave', () => {
            this.els.uploadArea.classList.remove('drag-over');
        });
        this.els.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.els.uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) this._loadFile(e.dataTransfer.files[0]);
        });

        // Global drag & drop overlay
        let dragCounter = 0;
        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            if (this.els.app.classList.contains('hidden')) return;
            this.els.dropOverlay.classList.remove('hidden');
        });
        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                this.els.dropOverlay.classList.add('hidden');
            }
        });
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            this.els.dropOverlay.classList.add('hidden');
            if (e.dataTransfer.files[0]) this._loadFile(e.dataTransfer.files[0]);
        });

        // Demo button
        this.els.loadDemoBtn.addEventListener('click', () => this._loadDemo());

        // New file button
        this.els.newFileBtn.addEventListener('click', () => this._reset());

        // Export
        this.els.exportBtn.addEventListener('click', () => this._exportSummary());

        // Search
        this.els.searchInput.addEventListener('input', () => {
            this.searchQuery = this.els.searchInput.value.trim().toLowerCase();
            this.els.searchClear.classList.toggle('hidden', !this.searchQuery);
            this._applyFilters();
        });
        this.els.searchClear.addEventListener('click', () => {
            this.els.searchInput.value = '';
            this.searchQuery = '';
            this.els.searchClear.classList.add('hidden');
            this._applyFilters();
        });

        // Type filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this._applyFilters();
            });
        });

        // Errors only
        this.els.errorsOnlyToggle.addEventListener('change', () => {
            this.errorsOnly = this.els.errorsOnlyToggle.checked;
            this._applyFilters();
        });

        // View tabs
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentView = tab.dataset.view;
                this._updateView();
            });
        });

        // Sort columns
        document.querySelectorAll('.table-header .col[data-sort]').forEach(col => {
            col.addEventListener('click', () => {
                const field = col.dataset.sort;
                if (this.sortField === field) {
                    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortField = field;
                    this.sortDir = 'asc';
                }
                document.querySelectorAll('.table-header .col').forEach(c => c.classList.remove('sort-asc', 'sort-desc'));
                col.classList.add(this.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
                this._applyFilters();
            });
        });

        // Detail tabs
        document.querySelectorAll('.detail-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._showDetailTab(tab.dataset.detail);
            });
        });

        // Detail close
        this.els.detailClose.addEventListener('click', () => this._closeDetail());

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this._closeDetail();
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.els.searchInput.focus();
            }
        });
    }

    /* -------- File Loading -------- */

    _loadFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.parser.parse(e.target.result);
                this._showApp(file.name);
            } catch (err) {
                alert('Error parsing HAR file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    _loadDemo() {
        const demo = DemoHarGenerator.generate();
        this.parser.parse(demo);
        this._showApp('demo-data.har');
    }

    _reset() {
        this.parser = new HarParser();
        this.filteredEntries = [];
        this.selectedEntry = null;
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.errorsOnly = false;
        this.sortField = null;
        this.sortDir = 'asc';

        this.els.searchInput.value = '';
        this.els.searchClear.classList.add('hidden');
        this.els.errorsOnlyToggle.checked = false;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
        document.querySelectorAll('.table-header .col').forEach(c => c.classList.remove('sort-asc', 'sort-desc'));

        this.els.app.classList.add('hidden');
        this.els.landing.classList.remove('hidden');
        this.els.detailPanel.classList.add('hidden');
    }

    /* -------- App Display -------- */

    _showApp(filename) {
        this.els.landing.classList.add('hidden');
        this.els.app.classList.remove('hidden');
        this.els.fileName.textContent = filename;

        this._updateStats();
        this._applyFilters();
        this.charts.renderAll(this.parser);
        this._updateView();
    }

    _updateStats() {
        const stats = this.parser.getStats();
        this.els.statRequests.textContent = stats.totalRequests;
        this.els.statTransferred.textContent = HarParser.formatBytes(stats.totalTransferred);
        this.els.statLoadTime.textContent = HarParser.formatTime(stats.loadTime);
        this.els.statDomains.textContent = stats.domainCount;
        this.els.statErrors.textContent = stats.errorCount;
    }

    _updateView() {
        if (this.currentView === 'waterfall') {
            this.els.waterfallView.classList.remove('hidden');
            this.els.chartView.classList.add('hidden');
        } else {
            this.els.waterfallView.classList.add('hidden');
            this.els.chartView.classList.remove('hidden');
            // Redraw charts on view switch
            this.charts.renderAll(this.parser);
        }
    }

    /* -------- Filtering & Sorting -------- */

    _applyFilters() {
        let entries = [...this.parser.entries];

        // Type filter
        if (this.currentFilter !== 'all') {
            entries = entries.filter(e => e.resourceType === this.currentFilter);
        }

        // Errors only
        if (this.errorsOnly) {
            entries = entries.filter(e => e.status >= 400 || e.status === 0);
        }

        // Search
        if (this.searchQuery) {
            entries = entries.filter(e =>
                e.url.toLowerCase().includes(this.searchQuery) ||
                e.filename.toLowerCase().includes(this.searchQuery) ||
                e.method.toLowerCase().includes(this.searchQuery) ||
                e.mimeType.toLowerCase().includes(this.searchQuery) ||
                String(e.status).includes(this.searchQuery) ||
                e.hostname.toLowerCase().includes(this.searchQuery)
            );
        }

        // Sort
        if (this.sortField) {
            const dir = this.sortDir === 'asc' ? 1 : -1;
            entries.sort((a, b) => {
                let va, vb;
                switch (this.sortField) {
                    case 'status': va = a.status; vb = b.status; break;
                    case 'method': va = a.method; vb = b.method; break;
                    case 'url': va = a.filename; vb = b.filename; break;
                    case 'type': va = a.resourceType; vb = b.resourceType; break;
                    case 'size': va = a.transferSize; vb = b.transferSize; break;
                    case 'time': va = a.time; vb = b.time; break;
                    default: return 0;
                }
                if (typeof va === 'string') return va.localeCompare(vb) * dir;
                return (va - vb) * dir;
            });
        }

        this.filteredEntries = entries;
        this._renderRequestList();
    }

    /* -------- Request List Rendering -------- */

    _renderRequestList() {
        const container = this.els.requestList;
        container.innerHTML = '';

        if (!this.filteredEntries.length) {
            container.innerHTML = '<div class="empty-state"><p>No matching requests</p></div>';
            return;
        }

        const timeRange = this.parser.getTimeRange();
        const fragment = document.createDocumentFragment();

        // Add legend at top
        const existingLegend = document.querySelector('.waterfall-legend');
        if (existingLegend) existingLegend.remove();

        for (const entry of this.filteredEntries) {
            const row = this._createRequestRow(entry, timeRange);
            fragment.appendChild(row);
        }

        container.appendChild(fragment);

        // Add legend after list
        const waterfallView = this.els.waterfallView;
        const existingLegend2 = waterfallView.querySelector('.waterfall-legend');
        if (existingLegend2) existingLegend2.remove();
        waterfallView.appendChild(this.waterfall.renderLegend());
    }

    _createRequestRow(entry, timeRange) {
        const row = document.createElement('div');
        row.className = 'request-row';
        row.dataset.id = entry.id;

        if (entry.status >= 400 || entry.status === 0) row.classList.add('error-row');
        else if (entry.status >= 300) row.classList.add('redirect-row');
        if (this.selectedEntry && this.selectedEntry.id === entry.id) row.classList.add('selected');

        // Status
        const status = document.createElement('span');
        status.className = 'cell cell-status';
        status.textContent = entry.status || '—';
        if (entry.status >= 200 && entry.status < 300) {
            status.style.background = 'rgba(63,185,80,.12)';
            status.style.color = '#3fb950';
        } else if (entry.status >= 300 && entry.status < 400) {
            status.style.background = 'rgba(210,153,34,.15)';
            status.style.color = '#d29922';
        } else if (entry.status >= 400) {
            status.style.background = 'rgba(248,81,73,.15)';
            status.style.color = '#f85149';
        } else {
            status.style.background = 'rgba(139,148,158,.12)';
            status.style.color = '#8b949e';
        }

        // Method
        const method = document.createElement('span');
        method.className = 'cell cell-method';
        method.textContent = entry.method;

        // Name
        const name = document.createElement('span');
        name.className = 'cell cell-name';
        name.textContent = entry.filename;
        name.title = entry.url;

        // Type
        const type = document.createElement('span');
        type.className = 'cell cell-type';
        type.textContent = entry.resourceType;

        // Size
        const size = document.createElement('span');
        size.className = 'cell cell-size';
        size.textContent = entry.transferSize > 0 ? HarParser.formatBytes(entry.transferSize) : '—';

        // Time
        const time = document.createElement('span');
        time.className = 'cell cell-time';
        time.textContent = HarParser.formatTime(entry.time);

        // Color time based on speed
        if (entry.time > 3000) time.style.color = '#f85149';
        else if (entry.time > 1000) time.style.color = '#d29922';
        else if (entry.time > 500) time.style.color = '#f0883e';

        // Waterfall
        const waterfallCell = document.createElement('span');
        waterfallCell.className = 'cell cell-waterfall';
        waterfallCell.appendChild(
            this.waterfall.renderBar(entry, timeRange.start, timeRange.duration)
        );

        row.append(status, method, name, type, size, time, waterfallCell);

        // Click handler
        row.addEventListener('click', () => this._selectEntry(entry, row));

        return row;
    }

    /* -------- Detail Panel -------- */

    _selectEntry(entry, row) {
        // Deselect previous
        const prev = this.els.requestList.querySelector('.selected');
        if (prev) prev.classList.remove('selected');

        this.selectedEntry = entry;
        row.classList.add('selected');

        this.els.detailPanel.classList.remove('hidden');

        // Reset to headers tab
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.detail-tab[data-detail="headers"]').classList.add('active');

        this._renderDetailHeaders(entry);
        this._renderDetailRequest(entry);
        this._renderDetailResponse(entry);
        this._renderDetailCookies(entry);
        this._renderDetailTiming(entry);
        this._showDetailTab('headers');
    }

    _closeDetail() {
        this.els.detailPanel.classList.add('hidden');
        this.selectedEntry = null;
        const prev = this.els.requestList.querySelector('.selected');
        if (prev) prev.classList.remove('selected');
    }

    _showDetailTab(tab) {
        ['headers', 'request', 'response', 'cookies', 'timing'].forEach(t => {
            const el = document.getElementById('detail-' + t);
            if (el) el.classList.toggle('hidden', t !== tab);
        });
    }

    _renderDetailHeaders(entry) {
        const el = this.els.detailHeaders;
        const statusClass = entry.status >= 400 ? 'error' : entry.status >= 300 ? 'redirect' : 'success';

        el.innerHTML = `
            <div class="detail-url">
                <span class="method-badge">${entry.method}</span>${this._escapeHtml(entry.url)}
                <span class="status-badge ${statusClass}">${entry.status} ${entry.statusText}</span>
            </div>

            <div class="header-group">
                <div class="header-group-title">General</div>
                ${this._headerRow('Request URL', entry.url)}
                ${this._headerRow('Request Method', entry.method)}
                ${this._headerRow('Status Code', entry.status + ' ' + entry.statusText)}
                ${this._headerRow('HTTP Version', entry.httpVersion)}
                ${entry.serverIPAddress ? this._headerRow('Server IP', entry.serverIPAddress) : ''}
                ${entry.redirectURL ? this._headerRow('Redirect URL', entry.redirectURL) : ''}
            </div>

            <div class="header-group">
                <div class="header-group-title">Response Headers (${entry.responseHeaders.length})</div>
                ${entry.responseHeaders.map(h => this._headerRow(h.name, h.value)).join('')}
            </div>

            <div class="header-group">
                <div class="header-group-title">Request Headers (${entry.requestHeaders.length})</div>
                ${entry.requestHeaders.map(h => this._headerRow(h.name, h.value)).join('')}
            </div>

            ${entry.queryString.length ? `
            <div class="header-group">
                <div class="header-group-title">Query Parameters (${entry.queryString.length})</div>
                ${entry.queryString.map(q => this._headerRow(q.name, q.value)).join('')}
            </div>
            ` : ''}
        `;
    }

    _renderDetailRequest(entry) {
        const el = this.els.detailRequest;
        if (entry.requestBody && entry.requestBody.text) {
            const formatted = this._tryFormatJSON(entry.requestBody.text);
            el.innerHTML = `
                <div class="header-group">
                    <div class="header-group-title">Request Body (${entry.requestBody.mimeType || 'unknown'})</div>
                    <div class="body-preview">${this._escapeHtml(formatted)}</div>
                </div>
            `;
        } else if (entry.requestBody && entry.requestBody.params) {
            el.innerHTML = `
                <div class="header-group">
                    <div class="header-group-title">Form Data</div>
                    ${entry.requestBody.params.map(p => this._headerRow(p.name, p.value || '')).join('')}
                </div>
            `;
        } else {
            el.innerHTML = '<div class="body-info">No request body</div>';
        }
    }

    _renderDetailResponse(entry) {
        const el = this.els.detailResponse;
        const content = entry.responseBody;

        el.innerHTML = `
            <div class="header-group">
                <div class="header-group-title">Response Info</div>
                ${this._headerRow('MIME Type', content.mimeType || 'unknown')}
                ${this._headerRow('Size', HarParser.formatBytes(content.size || 0))}
                ${content.compression ? this._headerRow('Compression', HarParser.formatBytes(content.compression)) : ''}
            </div>
        `;

        if (content.text) {
            const formatted = this._tryFormatJSON(content.text);
            const preview = formatted.length > 100000 ? formatted.substring(0, 100000) + '\n\n… (truncated)' : formatted;
            el.innerHTML += `
                <div class="header-group">
                    <div class="header-group-title">Response Body</div>
                    <div class="body-preview">${this._escapeHtml(preview)}</div>
                </div>
            `;
        } else {
            el.innerHTML += '<div class="body-info">Response body not captured in HAR</div>';
        }
    }

    _renderDetailCookies(entry) {
        const el = this.els.detailCookies;
        const reqCookies = entry.requestCookies || [];
        const resCookies = entry.responseCookies || [];

        let html = '';

        if (reqCookies.length) {
            html += `
                <div class="header-group">
                    <div class="header-group-title">Request Cookies (${reqCookies.length})</div>
                    <table class="cookie-table">
                        <tr><th>Name</th><th>Value</th></tr>
                        ${reqCookies.map(c => `<tr><td>${this._escapeHtml(c.name)}</td><td>${this._escapeHtml(c.value)}</td></tr>`).join('')}
                    </table>
                </div>
            `;
        }

        if (resCookies.length) {
            html += `
                <div class="header-group">
                    <div class="header-group-title">Response Cookies (${resCookies.length})</div>
                    <table class="cookie-table">
                        <tr><th>Name</th><th>Value</th><th>Domain</th><th>Path</th><th>Expires</th><th>HttpOnly</th><th>Secure</th></tr>
                        ${resCookies.map(c => `
                            <tr>
                                <td>${this._escapeHtml(c.name)}</td>
                                <td>${this._escapeHtml(c.value)}</td>
                                <td>${this._escapeHtml(c.domain || '')}</td>
                                <td>${this._escapeHtml(c.path || '')}</td>
                                <td>${c.expires || ''}</td>
                                <td>${c.httpOnly ? '✓' : ''}</td>
                                <td>${c.secure ? '✓' : ''}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
        }

        if (!reqCookies.length && !resCookies.length) {
            html = '<div class="body-info">No cookies</div>';
        }

        el.innerHTML = html;
    }

    _renderDetailTiming(entry) {
        const el = this.els.detailTiming;
        el.innerHTML = '';

        const urlDiv = document.createElement('div');
        urlDiv.className = 'detail-url';
        urlDiv.innerHTML = `<span class="method-badge">${entry.method}</span>${this._escapeHtml(entry.url)}`;
        el.appendChild(urlDiv);

        const info = document.createElement('div');
        info.className = 'header-group';
        info.innerHTML = `
            <div class="header-group-title">Timing Info</div>
            ${this._headerRow('Started', entry.startedDateTime.toISOString())}
            ${this._headerRow('Total Time', HarParser.formatTimePrecise(entry.time))}
            ${entry.serverIPAddress ? this._headerRow('Server IP', entry.serverIPAddress) : ''}
            ${entry.connection ? this._headerRow('Connection', entry.connection) : ''}
        `;
        el.appendChild(info);

        el.appendChild(this.waterfall.renderTimingDetail(entry));
    }

    /* -------- Export -------- */

    _exportSummary() {
        const stats = this.parser.getStats();
        const slowest = this.parser.getSlowest(10);
        const largest = this.parser.getLargest(10);
        const byType = this.parser.getByType();
        const byStatus = this.parser.getByStatus();

        let text = `NotFiddler — HAR Analysis Report\n`;
        text += `${'='.repeat(50)}\n\n`;
        text += `File: ${this.els.fileName.textContent}\n`;
        text += `Generated: ${new Date().toISOString()}\n\n`;

        text += `SUMMARY\n${'-'.repeat(30)}\n`;
        text += `Total Requests:  ${stats.totalRequests}\n`;
        text += `Transferred:     ${HarParser.formatBytes(stats.totalTransferred)}\n`;
        text += `Load Time:       ${HarParser.formatTime(stats.loadTime)}\n`;
        text += `Domains:         ${stats.domainCount}\n`;
        text += `Errors:          ${stats.errorCount}\n\n`;

        text += `REQUESTS BY TYPE\n${'-'.repeat(30)}\n`;
        for (const [type, g] of Object.entries(byType)) {
            text += `  ${type.padEnd(14)} ${String(g.count).padStart(4)} requests  ${HarParser.formatBytes(g.size).padStart(10)}\n`;
        }
        text += '\n';

        text += `RESPONSE CODES\n${'-'.repeat(30)}\n`;
        for (const [code, g] of Object.entries(byStatus)) {
            text += `  ${code.padEnd(10)} ${g.count} requests\n`;
        }
        text += '\n';

        text += `TOP 10 SLOWEST\n${'-'.repeat(30)}\n`;
        slowest.forEach((e, i) => {
            text += `  ${(i + 1 + '.').padEnd(4)} ${HarParser.formatTime(e.time).padStart(10)}  ${e.url}\n`;
        });
        text += '\n';

        text += `TOP 10 LARGEST\n${'-'.repeat(30)}\n`;
        largest.filter(e => e.transferSize > 0).forEach((e, i) => {
            text += `  ${(i + 1 + '.').padEnd(4)} ${HarParser.formatBytes(e.transferSize).padStart(10)}  ${e.url}\n`;
        });

        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'har-analysis-report.txt';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    /* -------- Helpers -------- */

    _headerRow(key, value) {
        return `<div class="header-row"><span class="header-key">${this._escapeHtml(key)}</span><span class="header-value">${this._escapeHtml(String(value))}</span></div>`;
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    _tryFormatJSON(text) {
        try {
            return JSON.stringify(JSON.parse(text), null, 2);
        } catch {
            return text;
        }
    }
}

window.UIController = UIController;
