'use strict';

/**
 * 集成测试：Game REST API
 * TDD — 先写测试，再验证路由与 service 行为
 *
 * 覆盖接口：
 *   POST   /api/games                 (F1)
 *   GET    /api/games/:id             (F1)
 *   POST   /api/games/:id/move        (F2, F3)
 *   POST   /api/games/:id/undo        (F4)
 *   POST   /api/games/:id/reset       (F5)
 *   GET    /api/games/:id/history     (F6)
 */

const request = require('supertest');
const app     = require('../server');
const store   = require('../store/gameStore');

beforeEach(() => {
  store.clear();
});

// ─── 辅助 ─────────────────────────────────────────────────────────────────────

async function createGame() {
  const res = await request(app).post('/api/games');
  return res.body.data;
}

// ─── F1 创建游戏 ──────────────────────────────────────────────────────────────

describe('F1 创建游戏 API', () => {
  test('IT-F1-01 POST /api/games 返回 201，含 success 与 data.id', async () => {
    const res = await request(app).post('/api/games');
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.id).toBe('string');
    expect(res.body.data.status).toBe('playing');
  });

  test('IT-F1-02 响应 board 格式正确（15×15）', async () => {
    const res = await request(app).post('/api/games');
    const { board } = res.body.data;
    expect(board).toHaveLength(15);
    board.forEach(row => expect(row).toHaveLength(15));
  });

  test('IT-F1-03 GET /api/games/:id 返回已创建的游戏', async () => {
    const game = await createGame();
    const res  = await request(app).get(`/api/games/${game.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(game.id);
  });

  test('IT-F1-04 GET /api/games/:id 不存在时返回 404', async () => {
    const res = await request(app).get('/api/games/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('GAME_NOT_FOUND');
  });
});

// ─── F2 落子 API ──────────────────────────────────────────────────────────────

describe('F2 落子 API', () => {
  test('IT-F2-01 合法落子返回 200，棋盘与回合更新', async () => {
    const game = await createGame();
    const res  = await request(app).post(`/api/games/${game.id}/move`).send({ row: 7, col: 7 });
    expect(res.status).toBe(200);
    expect(res.body.data.board[7][7]).toBe(1);
    expect(res.body.data.currentPlayer).toBe(2);
  });

  test('IT-F2-02 重复落子返回 400 INVALID_MOVE', async () => {
    const game = await createGame();
    await request(app).post(`/api/games/${game.id}/move`).send({ row: 7, col: 7 });
    const res = await request(app).post(`/api/games/${game.id}/move`).send({ row: 7, col: 7 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_MOVE');
  });

  test('IT-F2-03 越界坐标（row=-1）返回 400 OUT_OF_BOUNDS', async () => {
    const game = await createGame();
    const res  = await request(app).post(`/api/games/${game.id}/move`).send({ row: -1, col: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('OUT_OF_BOUNDS');
  });

  test('IT-F2-04 缺少 col 参数返回 400 BAD_REQUEST', async () => {
    const game = await createGame();
    const res  = await request(app).post(`/api/games/${game.id}/move`).send({ row: 7 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BAD_REQUEST');
  });

  test('IT-F2-05 游戏不存在返回 404 GAME_NOT_FOUND', async () => {
    const res = await request(app).post('/api/games/nonexistent/move').send({ row: 0, col: 0 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('GAME_NOT_FOUND');
  });
});

// ─── F3 胜负判断 API ──────────────────────────────────────────────────────────

describe('F3 胜负判断 API', () => {
  async function makeMove(id, row, col) {
    return request(app).post(`/api/games/${id}/move`).send({ row, col });
  }

  test('IT-F3-01 黑棋横向五连获胜，响应含 status 与 winningCells', async () => {
    const game = await createGame();
    const id   = game.id;
    // 黑: col 3,4,5,6,7  白: row0 垫子
    await makeMove(id, 7, 3); await makeMove(id, 0, 0);
    await makeMove(id, 7, 4); await makeMove(id, 0, 1);
    await makeMove(id, 7, 5); await makeMove(id, 0, 2);
    await makeMove(id, 7, 6); await makeMove(id, 0, 3);
    const res = await makeMove(id, 7, 7);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('black_win');
    expect(res.body.data.winningCells.length).toBeGreaterThanOrEqual(5);
  });

  test('IT-F3-02 获胜后再落子返回 400 GAME_OVER', async () => {
    const game = await createGame();
    const id   = game.id;
    await makeMove(id, 7, 3); await makeMove(id, 0, 0);
    await makeMove(id, 7, 4); await makeMove(id, 0, 1);
    await makeMove(id, 7, 5); await makeMove(id, 0, 2);
    await makeMove(id, 7, 6); await makeMove(id, 0, 3);
    await makeMove(id, 7, 7);
    const res = await makeMove(id, 1, 1);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('GAME_OVER');
  });
});

// ─── F4 悔棋 API ─────────────────────────────────────────────────────────────

describe('F4 悔棋 API', () => {
  test('IT-F4-01 悔棋成功，返回 200，落子位置恢复为 0', async () => {
    const game = await createGame();
    await request(app).post(`/api/games/${game.id}/move`).send({ row: 7, col: 7 });
    const res = await request(app).post(`/api/games/${game.id}/undo`);
    expect(res.status).toBe(200);
    expect(res.body.data.board[7][7]).toBe(0);
    expect(res.body.data.currentPlayer).toBe(1);
  });

  test('IT-F4-02 无历史悔棋返回 400 NO_HISTORY', async () => {
    const game = await createGame();
    const res  = await request(app).post(`/api/games/${game.id}/undo`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('NO_HISTORY');
  });
});

// ─── F5 重置游戏 API ──────────────────────────────────────────────────────────

describe('F5 重置游戏 API', () => {
  test('IT-F5-01 重置后返回 200，棋盘全空，currentPlayer = 1', async () => {
    const game = await createGame();
    await request(app).post(`/api/games/${game.id}/move`).send({ row: 7, col: 7 });
    const res = await request(app).post(`/api/games/${game.id}/reset`);
    expect(res.status).toBe(200);
    expect(res.body.data.currentPlayer).toBe(1);
    expect(res.body.data.status).toBe('playing');
    res.body.data.board.forEach(row => row.forEach(cell => expect(cell).toBe(0)));
  });

  test('IT-F5-02 重置不存在的游戏返回 404', async () => {
    const res = await request(app).post('/api/games/nonexistent/reset');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('GAME_NOT_FOUND');
  });
});

// ─── F6 查询历史 API ──────────────────────────────────────────────────────────

describe('F6 查询对局历史 API', () => {
  test('IT-F6-01 查询历史返回 200，含 row/col/player/seq 字段', async () => {
    const game = await createGame();
    await request(app).post(`/api/games/${game.id}/move`).send({ row: 7, col: 7 });
    await request(app).post(`/api/games/${game.id}/move`).send({ row: 3, col: 3 });
    const res = await request(app).get(`/api/games/${game.id}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const first = res.body.data[0];
    expect(first).toHaveProperty('row', 7);
    expect(first).toHaveProperty('col', 7);
    expect(first).toHaveProperty('player', 1);
    expect(first).toHaveProperty('seq', 1);
  });

  test('IT-F6-02 新游戏历史为空数组', async () => {
    const game = await createGame();
    const res  = await request(app).get(`/api/games/${game.id}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
