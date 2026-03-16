// Science Lab 5.2 — quiz bank (MVP: lightweight, per-element)

export function getQuizForElement(el) {
  // Return a single-question quiz for now.
  // Shape: { prompt, choices, correctIndex, explain }

  if (el.symbol === 'H') {
    return {
      prompt: 'Water is written as H₂O. How many hydrogen atoms are in a water molecule?',
      choices: ['1', '2', '8', '10'],
      correctIndex: 1,
      explain: 'H₂O means 2 hydrogen atoms (H₂) bonded to 1 oxygen atom (O).',
    };
  }

  if (el.symbol === 'O') {
    return {
      prompt: 'What does the “O” represent in the chemical formula H₂O?',
      choices: ['Osmium', 'Oxygen', 'Gold', 'Ozone'],
      correctIndex: 1,
      explain: 'In H₂O, O stands for Oxygen (atomic number 8).',
    };
  }

  if (el.symbol === 'C') {
    return {
      prompt: 'Which statement best describes Carbon in the periodic table?',
      choices: ['Noble gas', 'Alkali metal', 'Nonmetal (Group 14)', 'Halogen'],
      correctIndex: 2,
      explain: 'Carbon is a nonmetal in Group 14 and is central to organic chemistry.',
    };
  }

  // Generic fallback
  return {
    prompt: `Which value is the atomic number of ${el.name} (${el.symbol})?`,
    choices: shuffle([String(el.number), String(el.number + 1), String(Math.max(1, el.number - 1)), String(el.number + 10)], el.number),
    correctIndex: 0,
    explain: `Atomic number is the number of protons. For ${el.symbol}, it is ${el.number}.`,
  };
}

function shuffle(arr, seed) {
  // Deterministic shuffle (small)
  const a = arr.slice();
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
