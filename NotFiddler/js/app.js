/* ============================================================
   App — Entry point
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    window.app = new UIController();

    // Auto-load HAR file if ?load= parameter is present
    const params = new URLSearchParams(window.location.search);
    const loadFile = params.get('load');
    if (loadFile && /^[\w\-. ]+\.har$/i.test(loadFile)) {
        fetch(loadFile)
            .then(r => { if (!r.ok) throw new Error(r.statusText); return r.text(); })
            .then(text => {
                window.app.parser.parse(text);
                window.app._showApp(loadFile);
            })
            .catch(err => console.error('Auto-load failed:', err));
    }
});
