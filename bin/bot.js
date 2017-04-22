var xBot = require('../lib/xbot');
require('dotenv').config();

var token = process.env.BOT_API_KEY;
var dbPath = process.env.BOT_DB_PATH;
var name = process.env.BOT_NAME || 'xbot';

var xBot = new xBot({
    token: token,
    dbPath: dbPath,
    name: name
});

xBot.run();
