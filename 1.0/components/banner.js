// components/banner.js
export function renderBanner() {
  return `
    <div class="banner-container">
      <nav class="top-banner">
        <a href="#cv">View CV</a>
        <a href="#game-section">Play Sequence Game</a>
        <a href="#contact-section">Contact Me</a>
      </nav>

      <div class="new-clinical-banner">
        <h3>🧠 New: Alz-Jaime Clinical Mode <span class="new-badge">NEW</span></h3>
        <p>Experience our gentle memory support game designed specifically for Alzheimer's patients. No rush, no pressure - just therapeutic, calming interaction.</p>
        <a href="AlzJaime.html" class="clinical-link" target="_blank">Try Clinical Mode →</a>
      </div>
    </div>
  `;
}
