'use strict';

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const BOARD_SIZE      = 15;   // 15×15 grid
const CELL_SIZE       = 40;   // px per cell
const STONE_RATIO     = 0.82; // stone diameter / cell size
const AI_MOVE_DELAY_MS = 120; // ms delay before AI move so the UI can repaint

const BLACK = 1;
const WHITE = 2;

// Star-point positions (0-indexed row, col) for standard 15×15 board
const STAR_POINTS = [
  [3, 3], [3, 11], [7, 7], [11, 3], [11, 11],
  [3, 7], [7, 3],  [7, 11], [11, 7],
];

const MODE = { TWO_PLAYER: 'two-player', VS_AI: 'vs-ai' };

/* ─────────────────────────────────────────────
   Game state
───────────────────────────────────────────── */
let board        = [];   // 2-D array: 0=empty, 1=black, 2=white
let currentTurn  = BLACK;
let gameOver     = false;
let moveHistory  = [];   // [ {row, col, player}, … ]
let scores       = { [BLACK]: 0, [WHITE]: 0 };
let mode         = MODE.TWO_PLAYER;
let aiThinking   = false;

/* ─────────────────────────────────────────────
   DOM references
───────────────────────────────────────────── */
const boardEl       = document.getElementById('board');
const statusText    = document.getElementById('status-text');
const turnStoneEl   = document.getElementById('turn-stone');
const turnLabelEl   = document.getElementById('turn-label');
const scoreBlackEl  = document.getElementById('score-black');
const scoreWhiteEl  = document.getElementById('score-white');
const historyListEl = document.getElementById('history-list');
const btnRestart    = document.getElementById('btn-restart');
const btnUndo       = document.getElementById('btn-undo');
const winOverlay    = document.getElementById('win-overlay');
const winTitle      = document.getElementById('win-title');
const winMsg        = document.getElementById('win-msg');
const btnWinRestart = document.getElementById('btn-win-restart');
const modeBtns      = document.querySelectorAll('.mode-btn');

/* ─────────────────────────────────────────────
   Initialisation
───────────────────────────────────────────── */
function initBoard() {
  board       = Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(0));
  currentTurn = BLACK;
  gameOver    = false;
  moveHistory = [];
  aiThinking  = false;

  renderBoard();
  renderHistory();
  updateStatus();
  updateUndoBtn();
  winOverlay.classList.remove('show');
}

function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`;
  boardEl.style.gridTemplateRows    = `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`;
  boardEl.style.width               = `${BOARD_SIZE * CELL_SIZE}px`;
  boardEl.style.height              = `${BOARD_SIZE * CELL_SIZE}px`;

  const stoneSize = Math.round(CELL_SIZE * STONE_RATIO);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Edge classes to clip grid lines at board border
      if (r === 0)              cell.classList.add('edge-top');
      if (r === BOARD_SIZE - 1) cell.classList.add('edge-bottom');
      if (c === 0)              cell.classList.add('edge-left');
      if (c === BOARD_SIZE - 1) cell.classList.add('edge-right');

      // Star points
      if (STAR_POINTS.some(([sr, sc]) => sr === r && sc === c)) {
        cell.classList.add('star-point');
      }

      // Draw existing stone
      if (board[r][c] !== 0) {
        const stone = createStoneEl(board[r][c], stoneSize);
        const lastMove = moveHistory[moveHistory.length - 1];
        if (lastMove && lastMove.row === r && lastMove.col === c) {
          stone.classList.add('last-move');
        }
        cell.appendChild(stone);
      }

      // Hover listeners
      cell.addEventListener('mouseenter', onCellHover);
      cell.addEventListener('mouseleave', onCellLeave);
      cell.addEventListener('click', onCellClick);

      boardEl.appendChild(cell);
    }
  }
}

function createStoneEl(player, size) {
  const stone = document.createElement('div');
  stone.className = `stone ${player === BLACK ? 'black' : 'white'}`;
  stone.style.width  = `${size}px`;
  stone.style.height = `${size}px`;
  return stone;
}

/* ─────────────────────────────────────────────
   Event handlers
───────────────────────────────────────────── */
function onCellHover(e) {
  if (gameOver || aiThinking) return;
  if (mode === MODE.VS_AI && currentTurn === WHITE) return;

  const cell = e.currentTarget;
  const r = +cell.dataset.row;
  const c = +cell.dataset.col;
  if (board[r][c] !== 0) return;

  const stoneSize = Math.round(CELL_SIZE * STONE_RATIO);
  const preview = document.createElement('div');
  preview.className = `stone-preview ${currentTurn === BLACK ? 'black' : 'white'}`;
  preview.style.width  = `${stoneSize}px`;
  preview.style.height = `${stoneSize}px`;
  cell.classList.add('hover-preview');
  cell.appendChild(preview);
}

function onCellLeave(e) {
  const cell = e.currentTarget;
  cell.classList.remove('hover-preview');
  const preview = cell.querySelector('.stone-preview');
  if (preview) preview.remove();
}

function onCellClick(e) {
  if (gameOver || aiThinking) return;
  if (mode === MODE.VS_AI && currentTurn === WHITE) return;

  const cell = e.currentTarget;
  placeStone(+cell.dataset.row, +cell.dataset.col);
}

/* ─────────────────────────────────────────────
   Core logic
───────────────────────────────────────────── */
function placeStone(row, col) {
  if (board[row][col] !== 0) return;

  board[row][col] = currentTurn;
  moveHistory.push({ row, col, player: currentTurn });

  renderBoard();
  renderHistory();
  updateUndoBtn();

  const winner = checkWin(row, col, currentTurn);
  if (winner) {
    gameOver = true;
    scores[currentTurn]++;
    updateScores();
    showWinOverlay(currentTurn);
    updateStatus(currentTurn, true);
    return;
  }

  if (moveHistory.length === BOARD_SIZE * BOARD_SIZE) {
    gameOver = true;
    updateStatus(null, false, true);
    showDrawOverlay();
    return;
  }

  currentTurn = currentTurn === BLACK ? WHITE : BLACK;
  updateStatus();

  if (mode === MODE.VS_AI && currentTurn === WHITE && !gameOver) {
    aiThinking = true;
    updateStatus();
    // Small delay so UI updates before AI computation
    setTimeout(doAIMove, AI_MOVE_DELAY_MS);
  }
}

function doAIMove() {
  const move = aiPickMove();
  aiThinking = false;
  if (move) placeStone(move.row, move.col);
}

/* ─────────────────────────────────────────────
   Win detection
───────────────────────────────────────────── */
const DIRECTIONS = [
  [0, 1], [1, 0], [1, 1], [1, -1],
];

function checkWin(row, col, player) {
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    count += countDir(row, col, player,  dr,  dc);
    count += countDir(row, col, player, -dr, -dc);
    if (count >= 5) return player;
  }
  return null;
}

function countDir(row, col, player, dr, dc) {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

/* ─────────────────────────────────────────────
   AI  (threat-based heuristic)
───────────────────────────────────────────── */

/**
 * Score a hypothetical stone placement for a given player.
 * Higher = more valuable.
 */
function scorePosition(row, col, player) {
  let total = 0;
  for (const [dr, dc] of DIRECTIONS) {
    total += scoreDir(row, col, player, dr, dc);
  }
  return total;
}

function scoreDir(row, col, player, dr, dc) {
  // Count consecutive own stones in both directions, plus open ends
  let count = 1;
  let open  = 0;

  for (const [d, e] of [[dr, dc], [-dr, -dc]]) {
    let r = row + d;
    let c = col + e;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      if (board[r][c] === player) {
        count++;
        r += d;
        c += e;
      } else {
        if (board[r][c] === 0) open++;
        break;
      }
    }
    // Edge counts as closed end
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
      /* closed — don't increment open */
    }
  }

  if (count >= 5) return 100000;
  if (count === 4 && open === 2) return 10000;
  if (count === 4 && open === 1) return 1000;
  if (count === 3 && open === 2) return 500;
  if (count === 3 && open === 1) return 100;
  if (count === 2 && open === 2) return 50;
  if (count === 2 && open === 1) return 10;
  return open;
}

function aiPickMove() {
  const opponent = BLACK;
  let bestScore  = -Infinity;
  let bestMoves  = [];

  // Only consider cells adjacent to existing stones (or center if board empty)
  const candidates = getCandidates();

  for (const { row, col } of candidates) {
    if (board[row][col] !== 0) continue;

    // Offensive score (AI wins)
    const offScore = scorePosition(row, col, WHITE);
    // Defensive score (block human)
    const defScore = scorePosition(row, col, opponent);

    // Winning move — take immediately
    if (offScore >= 100000) return { row, col };

    // Combined score (weight offense slightly higher)
    const combined = offScore * 1.1 + defScore;
    if (combined > bestScore) {
      bestScore = combined;
      bestMoves = [{ row, col }];
    } else if (combined === bestScore) {
      bestMoves.push({ row, col });
    }
  }

  if (bestMoves.length === 0) return null;
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/**
 * Returns all empty cells within 2 steps of any placed stone.
 * Falls back to the center when the board is empty.
 */
function getCandidates() {
  const visited = Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(false));
  const result  = [];
  const RADIUS  = 2;

  let hasStone = false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) continue;
      hasStone = true;
      for (let dr = -RADIUS; dr <= RADIUS; dr++) {
        for (let dc = -RADIUS; dc <= RADIUS; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE &&
              board[nr][nc] === 0 && !visited[nr][nc]) {
            visited[nr][nc] = true;
            result.push({ row: nr, col: nc });
          }
        }
      }
    }
  }

  if (!hasStone) {
    const mid = Math.floor(BOARD_SIZE / 2);
    result.push({ row: mid, col: mid });
  }
  return result;
}

/* ─────────────────────────────────────────────
   UI helpers
───────────────────────────────────────────── */
function updateStatus(winner, isWin, isDraw) {
  if (isDraw) {
    statusText.textContent = '平局！';
    statusText.className   = 'status-draw';
    turnStoneEl.style.display  = 'none';
    turnLabelEl.textContent    = '';
    return;
  }
  if (isWin) {
    const name = winner === BLACK ? '黑棋' : '白棋';
    statusText.textContent = `${name} 获胜！🎉`;
    statusText.className   = 'status-win';
    turnStoneEl.style.display  = 'none';
    turnLabelEl.textContent    = '';
    return;
  }

  const isAITurn = mode === MODE.VS_AI && currentTurn === WHITE;
  const label    = currentTurn === BLACK
    ? (mode === MODE.VS_AI ? '你的回合（黑棋）' : '黑棋回合')
    : (isAITurn ? 'AI 思考中…' : '白棋回合');

  statusText.textContent     = label;
  statusText.className       = currentTurn === BLACK ? 'status-black' : 'status-white';
  turnStoneEl.className      = `${currentTurn === BLACK ? 'black' : 'white'}`;
  turnStoneEl.style.display  = 'block';
  turnLabelEl.textContent    = currentTurn === BLACK ? '黑棋' : '白棋';
}

function updateScores() {
  scoreBlackEl.textContent = scores[BLACK];
  scoreWhiteEl.textContent = scores[WHITE];
}

function updateUndoBtn() {
  btnUndo.disabled = moveHistory.length === 0 || gameOver;
}

function renderHistory() {
  historyListEl.innerHTML = '';
  const colLetters = 'ABCDEFGHJKLMNOP'; // standard Gomoku notation (skip I)
  moveHistory.forEach((m, i) => {
    const div  = document.createElement('div');
    const col  = colLetters[m.col];
    const row  = BOARD_SIZE - m.row;
    const who  = m.player === BLACK ? '⚫' : '⚪';
    div.textContent = `${i + 1}. ${who} ${col}${row}`;
    historyListEl.appendChild(div);
  });
  historyListEl.scrollTop = historyListEl.scrollHeight;
}

function showWinOverlay(winner) {
  const name = winner === BLACK ? '黑棋' : '白棋';
  const emoji = winner === BLACK ? '⚫' : '⚪';
  winTitle.textContent = `${emoji} ${name} 获胜！`;
  winMsg.textContent   = `恭喜获胜！共走了 ${moveHistory.length} 步。`;
  winOverlay.classList.add('show');
}

function showDrawOverlay() {
  winTitle.textContent = '平局！';
  winMsg.textContent   = `棋盘已满，平局收场。共走了 ${moveHistory.length} 步。`;
  winOverlay.classList.add('show');
}

/* ─────────────────────────────────────────────
   Controls
───────────────────────────────────────────── */
btnRestart.addEventListener('click', () => {
  initBoard();
});

btnWinRestart.addEventListener('click', () => {
  winOverlay.classList.remove('show');
  initBoard();
});

btnUndo.addEventListener('click', () => {
  if (moveHistory.length === 0 || gameOver) return;

  // In VS-AI mode, undo both AI move and player move together,
  // but only if the AI has already responded (last move is from WHITE).
  const lastMoveIsAI = moveHistory.length > 0 &&
    moveHistory[moveHistory.length - 1].player === WHITE;
  const movesToUndo = mode === MODE.VS_AI && lastMoveIsAI && moveHistory.length >= 2 ? 2 : 1;
  for (let i = 0; i < movesToUndo; i++) {
    const last = moveHistory.pop();
    if (last) board[last.row][last.col] = 0;
  }

  currentTurn = moveHistory.length > 0
    ? (moveHistory[moveHistory.length - 1].player === BLACK ? WHITE : BLACK)
    : BLACK;
  gameOver   = false;
  aiThinking = false;

  renderBoard();
  renderHistory();
  updateStatus();
  updateUndoBtn();
});

modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
    initBoard();
  });
});

/* ─────────────────────────────────────────────
   Bootstrap
───────────────────────────────────────────── */
initBoard();
