import { renderBanner } from './components/banner.js';
import { renderCV } from './components/cv.js';
import { renderGame } from './components/game.js';
import { renderBottomSpace } from './components/bottomSpace.js';
import { renderContact } from './components/contact.js';
import { initMemoryGame } from './memorySequenceGames.js';
import { initDifficulty1 } from './difficulty1.js';

// Renderizado
document.body.insertAdjacentHTML('afterbegin', renderBanner());
document.getElementById('cv-content').innerHTML = renderCV();
document.getElementById('game-section').innerHTML = renderGame();
document.getElementById('contact-section').innerHTML = renderContact();
document.querySelector('.bottom-space').innerHTML = renderBottomSpace();

// Inicialización de lógica
const difficultySelect = document.getElementById('difficulty');

// Function to initialize the appropriate game based on difficulty
function initializeGame() {
  const selectedDifficulty = parseInt(difficultySelect?.value || 1);

  if (selectedDifficulty === 1) {
    // Use the new difficulty 1 implementation
    initDifficulty1();
  } else {
    // Use the existing memory game for other difficulties
    initMemoryGame();
  }
}

// Initialize the game
initializeGame();

// Listen for difficulty changes to reinitialize
if (difficultySelect) {
  difficultySelect.addEventListener('change', () => {
    // Clear the game container
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = '';
    }
    // Reinitialize with new difficulty
    initializeGame();
  });
}

// Contact form handling
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = contactForm.querySelector('.contact-submit');
    const originalText = submitBtn.innerHTML;

    // Show loading state
    submitBtn.innerHTML = '<span class="submit-text">Sending...</span><span class="submit-icon">⏳</span>';
    submitBtn.disabled = true;

    try {
      const formData = new FormData(contactForm);
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        // Success
        submitBtn.innerHTML = '<span class="submit-text">Message Sent!</span><span class="submit-icon">✅</span>';
        contactForm.reset();

        // Show success message
        setTimeout(() => {
          alert('Thank you for your message! I\'ll get back to you soon.');
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }, 1000);
      } else {
        throw new Error('Form submission failed');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      submitBtn.innerHTML = '<span class="submit-text">Error - Try Again</span><span class="submit-icon">❌</span>';

      setTimeout(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }, 3000);
    }
  });
}
