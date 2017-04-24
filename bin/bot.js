let xBot = require('../lib/xbot');
require('dotenv').config();

const token = process.env.BOT_API_KEY;
const dbPath = process.env.BOT_DB_PATH;
const name = process.env.BOT_NAME || 'xbot';

xBot = new xBot({
  token,
  dbPath,
  name
});

xBot.run();
