// components/contact.js
export function renderContact() {
  return `
    <section class="contact-section" id="contact-section">
      <h2>🚀 Let's Build Something Amazing Together</h2>
      <p>
        Ready to transform your ideas into reality? Whether you need Salesforce solutions,
        technical support, or custom development, I'm here to help bring your vision to life.
      </p>

      <div class="contact-form-container">
        <form class="contact-form" action="https://formspree.io/f/mblaagwa" method="POST">
          <div class="form-group">
            <label for="contact-name">Name *</label>
            <input type="text" id="contact-name" name="name" required
                   placeholder="Your full name">
          </div>

          <div class="form-group">
            <label for="contact-email">Email *</label>
            <input type="email" id="contact-email" name="email" required
                   placeholder="your.email@example.com">
          </div>

          <div class="form-group">
            <label for="contact-whatsapp">WhatsApp</label>
            <input type="tel" id="contact-whatsapp" name="whatsapp"
                   placeholder="+1 (555) 123-4567">
          </div>

          <div class="form-group">
            <label for="contact-service">Service Interested In</label>
            <select id="contact-service" name="service">
              <option value="">Select a service...</option>
              <option value="salesforce-development">Salesforce Development</option>
              <option value="technical-support">Technical Support</option>
              <option value="consulting">Consulting</option>
              <option value="custom-development">Custom Development</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label for="contact-message">Tell me about your project *</label>
            <textarea id="contact-message" name="message" required
                      placeholder="Describe your project, timeline, and any specific requirements..."
                      rows="5"></textarea>
          </div>

          <button type="submit" class="contact-submit">
            <span class="submit-text">Send Message</span>
            <span class="submit-icon">✨</span>
          </button>
        </form>

        <div class="contact-info">
          <h3>💬 Let's Connect</h3>
          <div class="contact-methods">
            <div class="contact-method">
              <span class="method-icon">📧</span>
              <div>
                <strong>Email</strong><br>
                <a href="mailto:edwin.estro@me.com">edwin.estro@me.com</a>
              </div>
            </div>
            <div class="contact-method">
              <span class="method-icon">📱</span>
              <div>
                <strong>WhatsApp</strong><br>
                <a href="https://wa.me/5219141320191" target="_blank">+52 914 132 0191</a>
              </div>
            </div>
            <div class="contact-method">
              <span class="method-icon">💼</span>
              <div>
                <strong>LinkedIn</strong><br>
                <a href="https://www.linkedin.com/in/edwinestro" target="_blank">linkedin.com/in/edwinestro</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}
