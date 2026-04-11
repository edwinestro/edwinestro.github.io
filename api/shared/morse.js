'use strict';

const CHAR_TO_MORSE = {
  A: '.-',    B: '-...',  C: '-.-.',  D: '-..',   E: '.',
  F: '..-.',  G: '--.',   H: '....',  I: '..',    J: '.---',
  K: '-.-',   L: '.-..',  M: '--',    N: '-.',    O: '---',
  P: '.--.',  Q: '--.-',  R: '.-.',   S: '...',   T: '-',
  U: '..-',   V: '...-',  W: '.--',   X: '-..-',  Y: '-.--',
  Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--',
  '/': '-..-.', '-': '-....-', '(': '-.--.', ')': '-.--.-',
  ' ': '/',
};

const MORSE_TO_CHAR = Object.fromEntries(
  Object.entries(CHAR_TO_MORSE).map(([k, v]) => [v, k])
);

function textToMorse(text) {
  return String(text || '')
    .toUpperCase()
    .split('')
    .map((ch) => CHAR_TO_MORSE[ch] || '')
    .filter(Boolean)
    .join(' ');
}

function morseToText(morse) {
  return String(morse || '')
    .split(' ')
    .map((code) => (code === '/' ? ' ' : MORSE_TO_CHAR[code] || ''))
    .join('');
}

const STATUS_WORDS = {
  alive: 'ALIVE',
  idle: 'IDLE',
  processing: 'PROCESSING',
  error: 'ERROR',
  boot: 'BOOT',
};

function encodeStatus(status) {
  const word = STATUS_WORDS[String(status).toLowerCase()] || 'ALIVE';
  return { word, morse: textToMorse(word) };
}

module.exports = { textToMorse, morseToText, encodeStatus, CHAR_TO_MORSE, MORSE_TO_CHAR };
