/* ============================================================
   HAR Parser — Parses and analyzes HAR files
   ============================================================ */

class HarParser {
    constructor() {
        this.entries = [];
        this.pages = [];
        this.creator = null;
        this.browser = null;
        this.rawData = null;
    }

    /**
     * Parse a HAR JSON string or object
     */
    parse(input) {
        const data = typeof input === 'string' ? JSON.parse(input) : input;

        if (!data.log) {
            throw new Error('Invalid HAR file: missing "log" property');
        }

        this.rawData = data.log;
        this.creator = data.log.creator || null;
        this.browser = data.log.browser || null;
        this.pages = data.log.pages || [];
        this.entries = (data.log.entries || []).map((entry, index) => this._processEntry(entry, index));

        return this;
    }

    /**
     * Process a single HAR entry into a normalized format
     */
    _processEntry(entry, index) {
        const url = new URL(entry.request.url);
        const timings = entry.timings || {};

        return {
            id: index,
            // Request
            method: entry.request.method,
            url: entry.request.url,
            hostname: url.hostname,
            pathname: url.pathname,
            filename: this._getFilename(url),
            queryString: entry.request.queryString || [],
            requestHeaders: entry.request.headers || [],
            requestCookies: entry.request.cookies || [],
            requestBody: entry.request.postData || null,
            httpVersion: entry.request.httpVersion,

            // Response
            status: entry.response.status,
            statusText: entry.response.statusText,
            responseHeaders: entry.response.headers || [],
            responseCookies: entry.response.cookies || [],
            responseBody: entry.response.content || {},
            redirectURL: entry.response.redirectURL || '',

            // Sizes
            requestHeaderSize: entry.request.headersSize || 0,
            requestBodySize: entry.request.bodySize || 0,
            responseHeaderSize: entry.response.headersSize || 0,
            responseBodySize: entry.response.bodySize || 0,
            contentSize: (entry.response.content || {}).size || 0,
            transferSize: this._calcTransferSize(entry),

            // Type classification
            mimeType: (entry.response.content || {}).mimeType || '',
            resourceType: this._classifyResource(entry),

            // Timing
            startedDateTime: new Date(entry.startedDateTime),
            time: entry.time || 0,
            timings: {
                blocked: Math.max(timings.blocked || 0, 0),
                dns: Math.max(timings.dns || 0, 0),
                connect: Math.max(timings.connect || 0, 0),
                ssl: Math.max(timings.ssl || 0, 0),
                send: Math.max(timings.send || 0, 0),
                wait: Math.max(timings.wait || 0, 0),
                receive: Math.max(timings.receive || 0, 0),
            },

            // Meta
            serverIPAddress: entry.serverIPAddress || '',
            connection: entry.connection || '',
            pageref: entry.pageref || '',

            // Raw
            _raw: entry,
        };
    }

    _getFilename(url) {
        const parts = url.pathname.split('/');
        const last = parts[parts.length - 1];
        return last || url.hostname;
    }

    _calcTransferSize(entry) {
        const bodySize = entry.response.bodySize;
        if (bodySize && bodySize > 0) return bodySize;
        const contentSize = (entry.response.content || {}).size;
        return contentSize && contentSize > 0 ? contentSize : 0;
    }

    _classifyResource(entry) {
        const mime = ((entry.response.content || {}).mimeType || '').toLowerCase();
        const url = entry.request.url.toLowerCase();

        if (mime.includes('html')) return 'document';
        if (mime.includes('css')) return 'stylesheet';
        if (mime.includes('javascript') || mime.includes('ecmascript')) return 'script';
        if (mime.includes('json') || mime.includes('xml')) return 'xhr';
        if (mime.includes('font') || mime.includes('woff') || mime.includes('ttf') || mime.includes('otf')) return 'font';
        if (mime.includes('image') || mime.includes('svg')) return 'image';
        if (mime.includes('video') || mime.includes('audio')) return 'media';
        if (mime.includes('wasm')) return 'wasm';

        // Fallback to URL-based
        if (/\.(html?|asp|php|jsp)(\?|$)/i.test(url)) return 'document';
        if (/\.css(\?|$)/i.test(url)) return 'stylesheet';
        if (/\.(jsx?|tsx?|mjs)(\?|$)/i.test(url)) return 'script';
        if (/\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)/i.test(url)) return 'image';
        if (/\.(woff2?|ttf|otf|eot)/i.test(url)) return 'font';

        return 'other';
    }

    /* -------- Analysis Methods -------- */

    getStats() {
        const totalSize = this.entries.reduce((sum, e) => sum + e.transferSize, 0);
        const firstStart = this.entries.length ? Math.min(...this.entries.map(e => e.startedDateTime.getTime())) : 0;
        const lastEnd = this.entries.length ? Math.max(...this.entries.map(e => e.startedDateTime.getTime() + e.time)) : 0;
        const domains = new Set(this.entries.map(e => e.hostname));
        const errors = this.entries.filter(e => e.status >= 400 || e.status === 0);

        return {
            totalRequests: this.entries.length,
            totalTransferred: totalSize,
            loadTime: lastEnd - firstStart,
            domainCount: domains.size,
            errorCount: errors.length,
            domains: [...domains],
        };
    }

    getByType() {
        const groups = {};
        for (const entry of this.entries) {
            const type = entry.resourceType;
            if (!groups[type]) groups[type] = { count: 0, size: 0, entries: [] };
            groups[type].count++;
            groups[type].size += entry.transferSize;
            groups[type].entries.push(entry);
        }
        return groups;
    }

    getByStatus() {
        const groups = {};
        for (const entry of this.entries) {
            const bucket = entry.status === 0 ? 'Failed'
                : entry.status < 200 ? '1xx'
                : entry.status < 300 ? '2xx'
                : entry.status < 400 ? '3xx'
                : entry.status < 500 ? '4xx'
                : '5xx';
            if (!groups[bucket]) groups[bucket] = { count: 0, entries: [] };
            groups[bucket].count++;
            groups[bucket].entries.push(entry);
        }
        return groups;
    }

    getByDomain() {
        const groups = {};
        for (const entry of this.entries) {
            const host = entry.hostname;
            if (!groups[host]) groups[host] = { count: 0, size: 0, entries: [] };
            groups[host].count++;
            groups[host].size += entry.transferSize;
            groups[host].entries.push(entry);
        }
        return groups;
    }

    getSlowest(n = 10) {
        return [...this.entries].sort((a, b) => b.time - a.time).slice(0, n);
    }

    getLargest(n = 10) {
        return [...this.entries].sort((a, b) => b.transferSize - a.transferSize).slice(0, n);
    }

    getTimeRange() {
        if (!this.entries.length) return { start: 0, end: 0, duration: 0 };
        const start = Math.min(...this.entries.map(e => e.startedDateTime.getTime()));
        const end = Math.max(...this.entries.map(e => e.startedDateTime.getTime() + e.time));
        return { start, end, duration: end - start };
    }

    /* -------- Utility -------- */

    static formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)) + ' ' + sizes[i];
    }

    static formatTime(ms) {
        if (ms < 0) return '0 ms';
        if (ms < 1000) return Math.round(ms) + ' ms';
        if (ms < 60000) return (ms / 1000).toFixed(2) + ' s';
        return (ms / 60000).toFixed(1) + ' min';
    }

    static formatTimePrecise(ms) {
        if (ms < 0) return '0.00 ms';
        if (ms < 1000) return ms.toFixed(2) + ' ms';
        return (ms / 1000).toFixed(3) + ' s';
    }
}

/* -------- Demo HAR data generator -------- */
class DemoHarGenerator {
    static generate() {
        const now = new Date();
        const types = [
            { path: '/', mime: 'text/html', status: 200, method: 'GET', size: 15200 },
            { path: '/styles/main.css', mime: 'text/css', status: 200, method: 'GET', size: 42300 },
            { path: '/scripts/app.js', mime: 'application/javascript', status: 200, method: 'GET', size: 187400 },
            { path: '/scripts/vendor.js', mime: 'application/javascript', status: 200, method: 'GET', size: 354000 },
            { path: '/api/v1/user/profile', mime: 'application/json', status: 200, method: 'GET', size: 2340 },
            { path: '/api/v1/feed', mime: 'application/json', status: 200, method: 'GET', size: 48500 },
            { path: '/api/v1/notifications', mime: 'application/json', status: 304, method: 'GET', size: 0 },
            { path: '/images/logo.svg', mime: 'image/svg+xml', status: 200, method: 'GET', size: 3200 },
            { path: '/images/hero.webp', mime: 'image/webp', status: 200, method: 'GET', size: 245000 },
            { path: '/images/avatar.jpg', mime: 'image/jpeg', status: 200, method: 'GET', size: 18400 },
            { path: '/fonts/inter-v12.woff2', mime: 'font/woff2', status: 200, method: 'GET', size: 52600 },
            { path: '/fonts/mono.woff2', mime: 'font/woff2', status: 200, method: 'GET', size: 38700 },
            { path: '/api/v1/analytics', mime: 'application/json', status: 200, method: 'POST', size: 120 },
            { path: '/api/v1/search?q=hello', mime: 'application/json', status: 200, method: 'GET', size: 8900 },
            { path: '/api/v1/products', mime: 'application/json', status: 500, method: 'GET', size: 340 },
            { path: '/old-page', mime: 'text/html', status: 301, method: 'GET', size: 0 },
            { path: '/missing-resource.js', mime: 'text/html', status: 404, method: 'GET', size: 520 },
            { path: '/api/v1/auth/refresh', mime: 'application/json', status: 401, method: 'POST', size: 80 },
            { path: '/styles/theme.css', mime: 'text/css', status: 200, method: 'GET', size: 12700 },
            { path: '/scripts/analytics.js', mime: 'application/javascript', status: 200, method: 'GET', size: 28300 },
            { path: '/images/bg-pattern.png', mime: 'image/png', status: 200, method: 'GET', size: 67400 },
            { path: '/api/v1/comments?page=1', mime: 'application/json', status: 200, method: 'GET', size: 15200 },
            { path: '/api/v1/settings', mime: 'application/json', status: 403, method: 'GET', size: 190 },
            { path: '/scripts/polyfill.js', mime: 'application/javascript', status: 200, method: 'GET', size: 95800 },
            { path: '/favicon.ico', mime: 'image/x-icon', status: 200, method: 'GET', size: 4100 },
        ];

        let offset = 0;
        const entries = types.map((t) => {
            const blocked = Math.random() * 20;
            const dns = Math.random() * 30;
            const connect = Math.random() * 50;
            const ssl = Math.random() * 40;
            const send = Math.random() * 5;
            const wait = 20 + Math.random() * 300;
            const receive = 5 + Math.random() * (t.size / 500);
            const totalTime = blocked + dns + connect + ssl + send + wait + receive;

            offset += Math.random() * 150;
            const started = new Date(now.getTime() + offset);

            return {
                startedDateTime: started.toISOString(),
                time: totalTime,
                request: {
                    method: t.method,
                    url: `https://example.com${t.path}`,
                    httpVersion: 'HTTP/2.0',
                    headers: [
                        { name: 'Accept', value: t.mime.includes('html') ? 'text/html,application/xhtml+xml' : t.mime.includes('css') ? 'text/css' : '*/*' },
                        { name: 'Accept-Encoding', value: 'gzip, deflate, br' },
                        { name: 'Accept-Language', value: 'en-US,en;q=0.9' },
                        { name: 'Cache-Control', value: 'no-cache' },
                        { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
                        { name: 'Host', value: 'example.com' },
                    ],
                    queryString: t.path.includes('?') ? [{ name: 'q', value: 'hello' }] : [],
                    cookies: [
                        { name: 'session_id', value: 'abc123def456' },
                        { name: '_ga', value: 'GA1.2.123456789.1234567890' },
                    ],
                    headersSize: 320,
                    bodySize: t.method === 'POST' ? 180 : 0,
                    postData: t.method === 'POST' ? { mimeType: 'application/json', text: '{"event":"pageview","timestamp":' + Date.now() + '}' } : undefined,
                },
                response: {
                    status: t.status,
                    statusText: t.status === 200 ? 'OK' : t.status === 301 ? 'Moved Permanently' : t.status === 304 ? 'Not Modified' : t.status === 401 ? 'Unauthorized' : t.status === 403 ? 'Forbidden' : t.status === 404 ? 'Not Found' : t.status === 500 ? 'Internal Server Error' : 'OK',
                    httpVersion: 'HTTP/2.0',
                    headers: [
                        { name: 'Content-Type', value: t.mime },
                        { name: 'Content-Length', value: String(t.size) },
                        { name: 'Cache-Control', value: 'public, max-age=31536000' },
                        { name: 'Content-Encoding', value: 'br' },
                        { name: 'Server', value: 'nginx/1.24.0' },
                        { name: 'X-Request-Id', value: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) },
                    ],
                    cookies: [],
                    content: {
                        size: t.size,
                        mimeType: t.mime,
                        text: t.mime.includes('json') ? JSON.stringify({ status: 'ok', data: { items: [1, 2, 3] } }, null, 2) : undefined,
                    },
                    redirectURL: t.status === 301 ? 'https://example.com/new-page' : '',
                    headersSize: 240,
                    bodySize: Math.floor(t.size * 0.7),
                },
                cache: {},
                timings: {
                    blocked: blocked,
                    dns: dns,
                    connect: connect,
                    ssl: ssl,
                    send: send,
                    wait: wait,
                    receive: receive,
                },
                serverIPAddress: '93.184.216.34',
                connection: '443',
            };
        });

        return {
            log: {
                version: '1.2',
                creator: { name: 'NotFiddler Demo', version: '1.0' },
                browser: { name: 'Chrome', version: '120.0.0.0' },
                pages: [{
                    startedDateTime: now.toISOString(),
                    id: 'page_1',
                    title: 'https://example.com/',
                    pageTimings: { onContentLoad: 450, onLoad: 1235 },
                }],
                entries: entries,
            }
        };
    }
}

// Export for use
window.HarParser = HarParser;
window.DemoHarGenerator = DemoHarGenerator;
