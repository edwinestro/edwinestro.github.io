import { renderBanner } from './components/banner.js';
import { renderCV } from './components/cv.js';
import { renderGame } from './components/game.js';
import { renderBottomSpace } from './components/bottomSpace.js';
import { renderContact } from './components/contact.js';
import { initMemoryGame } from './memorySequenceGames.js';
import { initDifficulty1 } from './difficulty1.js';

// Renderizado
document.body.insertAdjacentHTML('afterbegin', renderBanner());
/* eslint-disable-next-line no-restricted-syntax */
document.getElementById('cv-content').innerHTML = renderCV();
/* eslint-disable-next-line no-restricted-syntax */
document.getElementById('game-section').innerHTML = renderGame();
/* eslint-disable-next-line no-restricted-syntax */
document.getElementById('contact-section').innerHTML = renderContact();
/* eslint-disable-next-line no-restricted-syntax */
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
      while(container.firstChild) container.removeChild(container.firstChild);
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
    const originalBtnClone = submitBtn.cloneNode(true);

    function setSubmitContent(btn, text, icon){
      while(btn.firstChild) btn.removeChild(btn.firstChild);
      const spanText = document.createElement('span'); spanText.className = 'submit-text'; spanText.textContent = text; btn.appendChild(spanText);
      if(icon){ const spanIcon = document.createElement('span'); spanIcon.className = 'submit-icon'; spanIcon.textContent = icon; btn.appendChild(spanIcon); }
    }

    // Show loading state
    setSubmitContent(submitBtn, 'Sending...', '⏳');
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
        setSubmitContent(submitBtn, 'Message Sent!', '✅');
        contactForm.reset();

        // Show success message
        setTimeout(() => {
          alert('Thank you for your message! I\'ll get back to you soon.');
          // Restore original button content
          if (originalBtnClone && originalBtnClone.parentNode){
            // If original clone was attached somewhere, replace; otherwise restore children
            while(submitBtn.firstChild) submitBtn.removeChild(submitBtn.firstChild);
            for(const n of originalBtnClone.childNodes) submitBtn.appendChild(n.cloneNode(true));
          }
          submitBtn.disabled = false;
        }, 1000);
      } else {
        throw new Error('Form submission failed');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitContent(submitBtn, 'Error - Try Again', '❌');

      setTimeout(() => {
        // Restore original button content
        if (originalBtnClone && originalBtnClone.parentNode){
          while(submitBtn.firstChild) submitBtn.removeChild(submitBtn.firstChild);
          for(const n of originalBtnClone.childNodes) submitBtn.appendChild(n.cloneNode(true));
        }
        submitBtn.disabled = false;
      }, 3000);
    }
  });
}
