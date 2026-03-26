'use strict';

const { Router } = require('express');
const svc = require('../services/gameService');

const router = Router();

function ok(res, data, statusCode = 200) {
  res.status(statusCode).json({ success: true, data });
}

function err(res, error) {
  const status = error.status || 500;
  res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message });
}

// POST /api/games — 创建游戏
router.post('/', (req, res) => {
  try {
    const game = svc.createGame();
    ok(res, game, 201);
  } catch (e) {
    err(res, e);
  }
});

// GET /api/games/:id — 获取游戏状态
router.get('/:id', (req, res) => {
  try {
    const game = svc.getGame(req.params.id);
    ok(res, game);
  } catch (e) {
    err(res, e);
  }
});

// POST /api/games/:id/move — 落子
router.post('/:id/move', (req, res) => {
  try {
    const game = svc.getGame(req.params.id);
    const { row, col } = req.body;
    ok(res, svc.makeMove(game, row, col));
  } catch (e) {
    err(res, e);
  }
});

// POST /api/games/:id/undo — 悔棋
router.post('/:id/undo', (req, res) => {
  try {
    const game = svc.getGame(req.params.id);
    ok(res, svc.undo(game));
  } catch (e) {
    err(res, e);
  }
});

// POST /api/games/:id/reset — 重置游戏
router.post('/:id/reset', (req, res) => {
  try {
    const game = svc.getGame(req.params.id);
    ok(res, svc.resetGame(game));
  } catch (e) {
    err(res, e);
  }
});

// GET /api/games/:id/history — 查询落子历史
router.get('/:id/history', (req, res) => {
  try {
    const game = svc.getGame(req.params.id);
    ok(res, svc.getHistory(game));
  } catch (e) {
    err(res, e);
  }
});

module.exports = router;
