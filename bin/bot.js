let LocationBot = require('../controllers/location_finder/xbot');
require('dotenv').config();

const token = process.env.BOT_API_KEY;
const dbPath = process.env.BOT_DB_PATH;
const name = process.env.BOT_NAME || 'xbot';

locationBot = new LocationBot({
  token,
  dbPath,
  name
});

locationBot.run();
