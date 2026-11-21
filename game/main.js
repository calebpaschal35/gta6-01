// Harborlight entry point: create the game on the page's canvas and run it.
import { Game } from './src/game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas, { seed: 7 });
window.__game = game;
game.start();
