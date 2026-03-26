'use strict';

const { v4: uuidv4 } = require('uuid');
const store = require('../store/gameStore');

const BOARD_SIZE = 15;
const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(0));
}

function collectWinCells(board, row, col, player) {
  for (const [dr, dc] of DIRECTIONS) {
    const cells = [{ row, col }];
    for (let d = 1; d < BOARD_SIZE; d++) {
      const r = row + dr * d, c = col + dc * d;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== player) break;
      cells.push({ row: r, col: c });
    }
    for (let d = 1; d < BOARD_SIZE; d++) {
      const r = row - dr * d, c = col - dc * d;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== player) break;
      cells.push({ row: r, col: c });
    }
    if (cells.length >= 5) return cells;
  }
  return null;
}

function isDraw(board) {
  return board.every(row => row.every(cell => cell !== 0));
}

// ─── Service Methods ──────────────────────────────────────────────────────────

function createGame() {
  const game = {
    id: uuidv4(),
    board: emptyBoard(),
    currentPlayer: 1,
    status: 'playing',
    winner: null,
    winningCells: [],
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.save(game);
  return game;
}

function getGame(id) {
  const game = store.findById(id);
  if (!game) throw Object.assign(new Error('游戏不存在'), { code: 'GAME_NOT_FOUND', status: 404 });
  return game;
}

function makeMove(game, row, col) {
  if (row === undefined || col === undefined || row === null || col === null) {
    throw Object.assign(new Error('缺少 row 或 col 参数'), { code: 'BAD_REQUEST', status: 400 });
  }
  const r = Number(row), c = Number(col);
  if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
    throw Object.assign(new Error('落子坐标越界'), { code: 'OUT_OF_BOUNDS', status: 400 });
  }
  if (game.status !== 'playing') {
    throw Object.assign(new Error('游戏已结束'), { code: 'GAME_OVER', status: 400 });
  }
  if (game.board[r][c] !== 0) {
    throw Object.assign(new Error('该位置已有棋子'), { code: 'INVALID_MOVE', status: 400 });
  }

  game.board[r][c] = game.currentPlayer;
  game.history.push({ row: r, col: c, player: game.currentPlayer, seq: game.history.length + 1 });

  const winCells = collectWinCells(game.board, r, c, game.currentPlayer);
  if (winCells) {
    game.status = game.currentPlayer === 1 ? 'black_win' : 'white_win';
    game.winner = game.currentPlayer;
    game.winningCells = winCells;
  } else if (isDraw(game.board)) {
    game.status = 'draw';
  } else {
    game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
  }

  game.updatedAt = new Date().toISOString();
  store.save(game);
  return game;
}

function undo(game) {
  if (game.history.length === 0) {
    throw Object.assign(new Error('没有可撤销的落子'), { code: 'NO_HISTORY', status: 400 });
  }
  const last = game.history.pop();
  game.board[last.row][last.col] = 0;
  game.currentPlayer = last.player;
  game.status = 'playing';
  game.winner = null;
  game.winningCells = [];
  game.updatedAt = new Date().toISOString();
  store.save(game);
  return game;
}

function resetGame(game) {
  game.board = emptyBoard();
  game.currentPlayer = 1;
  game.status = 'playing';
  game.winner = null;
  game.winningCells = [];
  game.history = [];
  game.updatedAt = new Date().toISOString();
  store.save(game);
  return game;
}

function getHistory(game) {
  return game.history;
}

module.exports = { createGame, getGame, makeMove, undo, resetGame, getHistory };
