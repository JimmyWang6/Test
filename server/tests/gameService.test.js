'use strict';

/**
 * 单元测试：gameService
 * TDD — 先写测试，再实现/修正业务逻辑
 *
 * 覆盖功能模块：
 *   F1 创建游戏
 *   F2 落子
 *   F3 胜负判断
 *   F4 悔棋
 *   F5 重置游戏
 *   F6 查询对局历史
 */

const store = require('../store/gameStore');
const svc   = require('../services/gameService');

beforeEach(() => {
  store.clear();
});

// ─── F1 创建游戏 ─────────────────────────────────────────────────────────────

describe('F1 创建游戏', () => {
  test('UT-F1-01 createGame 返回含合法 UUID 的游戏对象', () => {
    const game = svc.createGame();
    expect(game).toBeDefined();
    expect(typeof game.id).toBe('string');
    expect(game.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('UT-F1-02 棋盘初始状态全为空（225 个格子均为 0）', () => {
    const { board } = svc.createGame();
    expect(board).toHaveLength(15);
    board.forEach(row => {
      expect(row).toHaveLength(15);
      row.forEach(cell => expect(cell).toBe(0));
    });
  });

  test('UT-F1-03 黑棋默认先手（currentPlayer = 1）', () => {
    const game = svc.createGame();
    expect(game.currentPlayer).toBe(1);
  });

  test('UT-F1-04 多次创建游戏 ID 互不相同', () => {
    const ids = Array.from({ length: 10 }, () => svc.createGame().id);
    const unique = new Set(ids);
    expect(unique.size).toBe(10);
  });

  test('UT-F1-05 初始状态 status = "playing"，winner = null', () => {
    const game = svc.createGame();
    expect(game.status).toBe('playing');
    expect(game.winner).toBeNull();
    expect(game.winningCells).toHaveLength(0);
  });
});

// ─── F2 落子 ─────────────────────────────────────────────────────────────────

describe('F2 落子', () => {
  test('UT-F2-01 合法落子成功，棋盘更新，回合切换', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7);
    expect(game.board[7][7]).toBe(1);
    expect(game.currentPlayer).toBe(2);
  });

  test('UT-F2-02 重复落子抛出 INVALID_MOVE', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7);
    // 切换到白棋后，尝试在相同位置落子
    expect(() => svc.makeMove(game, 7, 7)).toThrow(expect.objectContaining({ code: 'INVALID_MOVE' }));
  });

  test('UT-F2-03 行坐标为负数抛出 OUT_OF_BOUNDS', () => {
    const game = svc.createGame();
    expect(() => svc.makeMove(game, -1, 0)).toThrow(expect.objectContaining({ code: 'OUT_OF_BOUNDS' }));
  });

  test('UT-F2-04 坐标超上限（row=15）抛出 OUT_OF_BOUNDS', () => {
    const game = svc.createGame();
    expect(() => svc.makeMove(game, 15, 0)).toThrow(expect.objectContaining({ code: 'OUT_OF_BOUNDS' }));
  });

  test('UT-F2-05 游戏结束后落子抛出 GAME_OVER', () => {
    const game = svc.createGame();
    // 构造黑棋横向五连
    [0, 1, 2, 3].forEach((c, i) => {
      svc.makeMove(game, 7, c);           // 黑
      svc.makeMove(game, 0, i);           // 白（不在胜利路径上）
    });
    svc.makeMove(game, 7, 4);             // 黑第5子，获胜
    expect(game.status).toBe('black_win');
    expect(() => svc.makeMove(game, 0, 0)).toThrow(expect.objectContaining({ code: 'GAME_OVER' }));
  });

  test('UT-F2-06 连续落子回合交替正确（黑→白→黑→白）', () => {
    const game = svc.createGame();
    const positions = [[0,0],[0,1],[0,2],[0,3]];
    const expected  = [2, 1, 2, 1];
    positions.forEach(([r, c], i) => {
      svc.makeMove(game, r, c);
      expect(game.currentPlayer).toBe(expected[i]);
    });
  });

  test('UT-F2-07 缺少 col 参数抛出 BAD_REQUEST', () => {
    const game = svc.createGame();
    expect(() => svc.makeMove(game, 7, undefined)).toThrow(expect.objectContaining({ code: 'BAD_REQUEST' }));
  });

  test('UT-F2-08 非整数坐标抛出 OUT_OF_BOUNDS', () => {
    const game = svc.createGame();
    expect(() => svc.makeMove(game, 1.5, 0)).toThrow(expect.objectContaining({ code: 'OUT_OF_BOUNDS' }));
  });
});

// ─── F3 胜负判断 ─────────────────────────────────────────────────────────────

/**
 * 辅助：交替落子，让黑棋落在 blackMoves，白棋填充 whiteMoves（垫子）。
 * blackMoves 中最后一步不自动补白。
 */
function playGame(game, blackMoves, whiteMoves) {
  const len = Math.max(blackMoves.length, whiteMoves.length);
  for (let i = 0; i < len; i++) {
    if (i < blackMoves.length) svc.makeMove(game, blackMoves[i][0], blackMoves[i][1]);
    if (i < whiteMoves.length) svc.makeMove(game, whiteMoves[i][0], whiteMoves[i][1]);
  }
}

describe('F3 胜负判断', () => {
  test('UT-F3-01 横向五连判定黑棋获胜', () => {
    const game = svc.createGame();
    const black = [[7,3],[7,4],[7,5],[7,6],[7,7]];
    const white = [[0,0],[0,1],[0,2],[0,3]];
    playGame(game, black, white);
    expect(game.status).toBe('black_win');
    expect(game.winner).toBe(1);
  });

  test('UT-F3-02 纵向五连判定黑棋获胜', () => {
    const game = svc.createGame();
    const black = [[3,7],[4,7],[5,7],[6,7],[7,7]];
    const white = [[0,0],[0,1],[0,2],[0,3]];
    playGame(game, black, white);
    expect(game.status).toBe('black_win');
    expect(game.winner).toBe(1);
  });

  test('UT-F3-03 主对角线五连判定黑棋获胜', () => {
    const game = svc.createGame();
    const black = [[3,3],[4,4],[5,5],[6,6],[7,7]];
    const white = [[0,0],[0,1],[0,2],[0,3]];
    playGame(game, black, white);
    expect(game.status).toBe('black_win');
    expect(game.winner).toBe(1);
  });

  test('UT-F3-04 副对角线五连判定黑棋获胜', () => {
    const game = svc.createGame();
    const black = [[3,7],[4,6],[5,5],[6,4],[7,3]];
    const white = [[0,0],[0,1],[0,2],[0,3]];
    playGame(game, black, white);
    expect(game.status).toBe('black_win');
    expect(game.winner).toBe(1);
  });

  test('UT-F3-05 四子不判胜，游戏继续', () => {
    const game = svc.createGame();
    const black = [[7,3],[7,4],[7,5],[7,6]];
    const white = [[0,0],[0,1],[0,2]];
    playGame(game, black, white);
    expect(game.status).toBe('playing');
    expect(game.winner).toBeNull();
  });

  test('UT-F3-06 白棋横向五连判定白棋获胜', () => {
    const game = svc.createGame();
    // 黑: 垫子分散在不同行列，确保不形成五连
    const black = [[0,0],[2,1],[4,2],[6,3],[8,4]];
    // 白: 连落5子在第7行
    const white = [[7,3],[7,4],[7,5],[7,6],[7,7]];
    for (let i = 0; i < 4; i++) {
      svc.makeMove(game, black[i][0], black[i][1]);
      svc.makeMove(game, white[i][0], white[i][1]);
    }
    svc.makeMove(game, black[4][0], black[4][1]); // 黑第5步
    svc.makeMove(game, white[4][0], white[4][1]); // 白第5步，获胜
    expect(game.status).toBe('white_win');
    expect(game.winner).toBe(2);
  });

  test('UT-F3-07 获胜时 winningCells 包含 5 个正确坐标', () => {
    const game = svc.createGame();
    const black = [[7,3],[7,4],[7,5],[7,6],[7,7]];
    const white = [[0,0],[0,1],[0,2],[0,3]];
    playGame(game, black, white);
    expect(game.winningCells.length).toBeGreaterThanOrEqual(5);
    game.winningCells.forEach(cell => {
      expect(cell).toHaveProperty('row');
      expect(cell).toHaveProperty('col');
    });
  });

  test('UT-F3-08 棋盘填满且无五连判定平局', () => {
    const game = svc.createGame();
    // 构造无五连满棋盘
    // 规律: rg = floor(r/3)%2, cg = floor(c/2)%2, val = (rg XOR cg) + 1
    // 水平方向最大连续=2，垂直最大连续=3，任意对角最大连续=4，均不足五连
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const rg = Math.floor(r / 3) % 2;
        const cg = Math.floor(c / 2) % 2;
        game.board[r][c] = (rg ^ cg) + 1;
      }
    }
    // (14,14) 按公式值为 2（白棋），清空后由白棋落最后一子触发平局判断
    game.board[14][14] = 0;
    game.currentPlayer = 2;
    svc.makeMove(game, 14, 14);
    expect(game.status).toBe('draw');
  });
});

// ─── F4 悔棋 ─────────────────────────────────────────────────────────────────

describe('F4 悔棋', () => {
  test('UT-F4-01 悔棋后棋盘恢复，回合还原', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7);
    expect(game.board[7][7]).toBe(1);
    svc.undo(game);
    expect(game.board[7][7]).toBe(0);
    expect(game.currentPlayer).toBe(1);
  });

  test('UT-F4-02 悔棋后 history 长度减 1', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7);
    svc.makeMove(game, 7, 8);
    svc.makeMove(game, 7, 9);
    expect(game.history).toHaveLength(3);
    svc.undo(game);
    expect(game.history).toHaveLength(2);
  });

  test('UT-F4-03 无历史时悔棋抛出 NO_HISTORY', () => {
    const game = svc.createGame();
    expect(() => svc.undo(game)).toThrow(expect.objectContaining({ code: 'NO_HISTORY' }));
  });

  test('UT-F4-04 胜负已定后悔棋，状态恢复为 playing', () => {
    const game = svc.createGame();
    const black = [[7,3],[7,4],[7,5],[7,6],[7,7]];
    const white = [[0,0],[0,1],[0,2],[0,3]];
    playGame(game, black, white);
    expect(game.status).toBe('black_win');
    svc.undo(game);
    expect(game.status).toBe('playing');
    expect(game.winner).toBeNull();
  });

  test('UT-F4-05 连续悔棋 3 次后棋盘正确还原到第 2 步', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7); // 黑 seq1
    svc.makeMove(game, 7, 8); // 白 seq2
    svc.makeMove(game, 7, 9); // 黑 seq3
    svc.makeMove(game, 7,10); // 白 seq4
    svc.makeMove(game, 7,11); // 黑 seq5
    svc.undo(game); // 撤销 seq5
    svc.undo(game); // 撤销 seq4
    svc.undo(game); // 撤销 seq3
    expect(game.history).toHaveLength(2);
    expect(game.board[7][9]).toBe(0);
    expect(game.board[7][10]).toBe(0);
    expect(game.board[7][11]).toBe(0);
    expect(game.board[7][7]).toBe(1);
    expect(game.board[7][8]).toBe(2);
  });
});

// ─── F5 重置游戏 ──────────────────────────────────────────────────────────────

describe('F5 重置游戏', () => {
  test('UT-F5-01 重置后棋盘全空', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7);
    svc.makeMove(game, 3, 3);
    svc.resetGame(game);
    game.board.forEach(row => row.forEach(cell => expect(cell).toBe(0)));
  });

  test('UT-F5-02 重置后黑棋先手（currentPlayer = 1）', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7); // 黑落子后 currentPlayer = 2
    svc.resetGame(game);
    expect(game.currentPlayer).toBe(1);
  });

  test('UT-F5-03 重置后 history 清空', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7);
    svc.makeMove(game, 3, 3);
    svc.resetGame(game);
    expect(game.history).toHaveLength(0);
  });

  test('UT-F5-04 重置后 status = "playing"，winner = null', () => {
    const game = svc.createGame();
    const black = [[7,3],[7,4],[7,5],[7,6],[7,7]];
    const white = [[0,0],[0,1],[0,2],[0,3]];
    playGame(game, black, white);
    expect(game.status).toBe('black_win');
    svc.resetGame(game);
    expect(game.status).toBe('playing');
    expect(game.winner).toBeNull();
    expect(game.winningCells).toHaveLength(0);
  });
});

// ─── F6 查询对局历史 ──────────────────────────────────────────────────────────

describe('F6 查询对局历史', () => {
  test('UT-F6-01 历史记录顺序正确，seq 字段从 1 递增', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7);
    svc.makeMove(game, 3, 3);
    svc.makeMove(game, 7, 8);
    const history = svc.getHistory(game);
    expect(history).toHaveLength(3);
    history.forEach((entry, i) => expect(entry.seq).toBe(i + 1));
  });

  test('UT-F6-02 历史记录含正确的玩家信息', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7);
    svc.makeMove(game, 3, 3);
    const history = svc.getHistory(game);
    expect(history[0].player).toBe(1);
    expect(history[1].player).toBe(2);
  });

  test('UT-F6-03 历史记录含正确的坐标', () => {
    const game = svc.createGame();
    svc.makeMove(game, 7, 7);
    const history = svc.getHistory(game);
    expect(history[0].row).toBe(7);
    expect(history[0].col).toBe(7);
  });

  test('UT-F6-04 新游戏历史为空数组', () => {
    const game = svc.createGame();
    expect(svc.getHistory(game)).toEqual([]);
  });
});
