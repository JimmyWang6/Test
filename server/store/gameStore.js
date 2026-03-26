'use strict';

/**
 * 内存游戏数据存储
 * 生产环境可替换为 SQLite / Redis 等持久化方案
 */
const store = new Map();

function save(game) {
  store.set(game.id, game);
}

function findById(id) {
  return store.get(id) || null;
}

function remove(id) {
  store.delete(id);
}

function clear() {
  store.clear();
}

module.exports = { save, findById, remove, clear };
