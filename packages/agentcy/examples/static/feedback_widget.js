// Tiny embeddable widget that posts feedback to a configurable endpoint.
// Usage: include this script with <script src="/path/feedback_widget.js" data-endpoint="https://.../feedback" async></script>

(function () {
  function getEndpoint(el) {
    return el.getAttribute('data-endpoint') || '/feedback';
  }

  function getMode(el) {
    return (el.getAttribute('data-mode') || 'api').toLowerCase();
  }

  function getGithubRepo(el) {
    return el.getAttribute('data-github-repo') || '';
  }

  function getGithubLabels(el) {
    return el.getAttribute('data-github-labels') || 'feedback';
  }

  function getApp(el) {
    return el.getAttribute('data-app') || '';
  }

  function openGithubIssue(repo, feedbackText, labels) {
    if (!repo || repo.indexOf('/') === -1) {
      throw new Error('Missing or invalid data-github-repo (expected owner/repo).');
    }
    var title = 'Game feedback: ' + feedbackText.slice(0, 60).replace(/\s+/g, ' ').trim();
    var body = [
      '## Feedback',
      feedbackText,
      '',
      '---',
      'Submitted from the site feedback widget.'
    ].join('\n');

    var url = 'https://github.com/' + repo + '/issues/new'
      + '?title=' + encodeURIComponent(title)
      + '&body=' + encodeURIComponent(body);

    if (labels && labels.trim()) {
      url += '&labels=' + encodeURIComponent(labels.trim());
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function createWidget(options) {
    const container = document.createElement('div');
    container.style.border = '1px solid rgba(255,255,255,0.14)';
    container.style.padding = '12px';
    container.style.maxWidth = '420px';
    container.style.borderRadius = '16px';
    container.style.background = 'linear-gradient(135deg, rgba(6, 18, 40, 0.92), rgba(20, 10, 40, 0.88))';
    container.style.boxShadow = '0 14px 40px rgba(0,0,0,0.28)';
    container.style.backdropFilter = 'blur(6px)';
    container.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    container.style.color = 'rgba(255,255,255,0.92)';

    const banner = document.createElement('div');
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'space-between';
    banner.style.gap = '10px';
    banner.style.padding = '10px 12px';
    banner.style.borderRadius = '12px';
    banner.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(168, 85, 247, 0.18))';
    banner.style.border = '1px solid rgba(255,255,255,0.14)';

    const bannerLeft = document.createElement('div');

    const bannerTitle = document.createElement('div');
    bannerTitle.textContent = 'Your feedback improves this game';
    bannerTitle.style.fontWeight = '700';
    bannerTitle.style.letterSpacing = '0.2px';

    const bannerSub = document.createElement('div');
    bannerSub.textContent = 'Stored now. Curated hourly by Azure Foundry to improve the game behind the scenes.';
    bannerSub.style.marginTop = '2px';
    bannerSub.style.fontSize = '12.5px';
    bannerSub.style.color = 'rgba(255,255,255,0.78)';

    bannerLeft.appendChild(bannerTitle);
    bannerLeft.appendChild(bannerSub);

    const badge = document.createElement('div');
    badge.textContent = 'Azure Foundry';
    badge.style.whiteSpace = 'nowrap';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = '700';
    badge.style.padding = '6px 10px';
    badge.style.borderRadius = '999px';
    badge.style.background = 'rgba(255,255,255,0.10)';
    badge.style.border = '1px solid rgba(255,255,255,0.16)';

    banner.appendChild(bannerLeft);
    banner.appendChild(badge);

    let selectedThumbsUp = null; // true | false | null

    const ratingWrap = document.createElement('div');
    ratingWrap.style.marginTop = '10px';
    ratingWrap.style.padding = '10px 12px';
    ratingWrap.style.borderRadius = '12px';
    ratingWrap.style.border = '1px solid rgba(255,255,255,0.14)';
    ratingWrap.style.background = 'rgba(0,0,0,0.14)';

    const ratingLabel = document.createElement('div');
    ratingLabel.textContent = 'Quick rating';
    ratingLabel.style.fontWeight = '700';
    ratingLabel.style.marginBottom = '8px';

    const thumbsRow = document.createElement('div');
    thumbsRow.style.display = 'flex';
    thumbsRow.style.gap = '10px';
    thumbsRow.style.alignItems = 'center';

    const ratingHint = document.createElement('div');
    ratingHint.textContent = 'Thumbs up or down.';
    ratingHint.style.marginTop = '8px';
    ratingHint.style.fontSize = '12.5px';
    ratingHint.style.color = 'rgba(255,255,255,0.72)';

    function styleThumb(btn, isSelected) {
      btn.style.border = isSelected ? '1px solid rgba(34, 197, 94, 0.55)' : '1px solid rgba(255,255,255,0.18)';
      btn.style.background = isSelected ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255,255,255,0.06)';
      btn.style.transform = isSelected ? 'translateY(-1px)' : 'none';
    }

    function renderThumbs() {
      styleThumb(thumbUpBtn, selectedThumbsUp === true);
      styleThumb(thumbDownBtn, selectedThumbsUp === false);
      if (selectedThumbsUp === true) ratingHint.textContent = 'Selected: 👍';
      else if (selectedThumbsUp === false) ratingHint.textContent = 'Selected: 👎';
      else ratingHint.textContent = 'Thumbs up or down.';
    }

    const thumbUpBtn = document.createElement('button');
    thumbUpBtn.type = 'button';
    thumbUpBtn.setAttribute('aria-label', 'Thumbs up');
    thumbUpBtn.textContent = '👍';
    thumbUpBtn.style.width = '56px';
    thumbUpBtn.style.height = '44px';
    thumbUpBtn.style.borderRadius = '12px';
    thumbUpBtn.style.color = 'rgba(255,255,255,0.94)';
    thumbUpBtn.style.fontSize = '20px';
    thumbUpBtn.style.fontWeight = '900';
    thumbUpBtn.style.cursor = 'pointer';
    thumbUpBtn.addEventListener('click', function () {
      selectedThumbsUp = true;
      renderThumbs();
    });

    const thumbDownBtn = document.createElement('button');
    thumbDownBtn.type = 'button';
    thumbDownBtn.setAttribute('aria-label', 'Thumbs down');
    thumbDownBtn.textContent = '👎';
    thumbDownBtn.style.width = '56px';
    thumbDownBtn.style.height = '44px';
    thumbDownBtn.style.borderRadius = '12px';
    thumbDownBtn.style.color = 'rgba(255,255,255,0.94)';
    thumbDownBtn.style.fontSize = '20px';
    thumbDownBtn.style.fontWeight = '900';
    thumbDownBtn.style.cursor = 'pointer';

    thumbDownBtn.addEventListener('click', function () {
      selectedThumbsUp = false;
      renderThumbs();
    });

    thumbsRow.appendChild(thumbUpBtn);
    thumbsRow.appendChild(thumbDownBtn);
    renderThumbs();

    ratingWrap.appendChild(ratingLabel);
    ratingWrap.appendChild(thumbsRow);
    ratingWrap.appendChild(ratingHint);

    const textarea = document.createElement('textarea');
    textarea.rows = 4;
    textarea.style.width = '100%';
    textarea.style.marginTop = '10px';
    textarea.style.padding = '10px 12px';
    textarea.style.borderRadius = '12px';
    textarea.style.border = '1px solid rgba(255,255,255,0.16)';
    textarea.style.background = 'rgba(0,0,0,0.18)';
    textarea.style.color = 'rgba(255,255,255,0.92)';
    textarea.style.outline = 'none';
    textarea.style.resize = 'vertical';
    textarea.placeholder = "Optional: what happened, what you'd change, or any bugs you noticed...";

    const submit = document.createElement('button');
    submit.textContent = 'Submit';
    submit.style.marginTop = '10px';
    submit.style.padding = '10px 12px';
    submit.style.borderRadius = '12px';
    submit.style.border = '1px solid rgba(255,255,255,0.18)';
    submit.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.92), rgba(59, 130, 246, 0.85))';
    submit.style.color = 'rgba(5, 10, 20, 0.95)';
    submit.style.fontWeight = '800';
    submit.style.cursor = 'pointer';

    const status = document.createElement('div');
    status.style.marginTop = '8px';
    status.style.fontSize = '13px';
    status.style.color = 'rgba(255,255,255,0.78)';

    submit.addEventListener('click', function () {
      const value = textarea.value.trim();
      if (selectedThumbsUp === null) {
        status.textContent = 'Please choose 👍 or 👎.';
        return;
      }

      const appName = options.app || '';

      if (options.mode === 'github-issue') {
        try {
          var vote = selectedThumbsUp ? '👍' : '👎';
          var body = [
            'Vote: ' + vote,
            (appName ? ('App: ' + appName) : ''),
            (window.location && window.location.href ? ('Page: ' + window.location.href) : ''),
            '',
            'Description:',
            (value ? value : '(none)')
          ].filter(Boolean).join('\n');
          openGithubIssue(options.githubRepo, body, options.githubLabels);
          status.textContent = 'Opened GitHub issue form in a new tab.';
        } catch (err) {
          console.error(err);
          status.textContent = 'Error opening GitHub issue form.';
        }
        return;
      }

      status.textContent = 'Sending...';
      fetch(options.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thumbs_up: selectedThumbsUp,
          app: appName,
          description: value,
          page_url: window.location && window.location.href ? window.location.href : undefined,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          status.textContent = 'Thanks! Your feedback is logged.';
          textarea.value = '';
          selectedThumbsUp = null;
          renderThumbs();
        })
        .catch((err) => {
          console.error(err);
          status.textContent = 'Error sending feedback.';
        });
    });

    container.appendChild(banner);
    container.appendChild(ratingWrap);
    container.appendChild(textarea);
    container.appendChild(submit);
    container.appendChild(status);
    return container;
  }

  // Auto-mount for any script tag that includes data-autoinit attribute
  document.addEventListener('DOMContentLoaded', function () {
    const scripts = document.querySelectorAll('script[src$="feedback_widget.js"][data-autoinit]');
    scripts.forEach(function (s) {
      const mode = getMode(s);
      const widget = createWidget({
        mode: mode,
        endpoint: getEndpoint(s),
        githubRepo: getGithubRepo(s),
        githubLabels: getGithubLabels(s),
        app: getApp(s),
      });
      s.parentNode.insertBefore(widget, s.nextSibling);
    });
  });
})();
