'use strict';

const express = require('express');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.use('/api/games', require('./routes/game'));

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: '接口不存在' });
});

const PORT = process.env.PORT || 3000;

/* istanbul ignore next */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`五子棋服务已启动：http://localhost:${PORT}`);
  });
}

module.exports = app;
