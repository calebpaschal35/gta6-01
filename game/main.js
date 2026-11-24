// Harborlight — entrypoint. Boots the game on the canvas.
import { Game } from './src/game.js';

const canvas = document.getElementById('game');
canvas.width = 1280;
canvas.height = 720;
const game = new Game(canvas);
game.start();
