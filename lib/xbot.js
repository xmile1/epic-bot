const util = require('util');
const path = require('path');
const fs = require('fs');
const SQLite = require('sqlite3').verbose();
const Bot = require('slackbots');
const moment = require('moment');

class xBot extends Bot {
  constructor(settings) {
    super(settings);
    this.settings = settings;
    this.settings.name = this.settings.name || 'xbot';
    this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'xbot.db');
    this.user = null;
    this.db = null;
    this.meetingRoomDetails = [];
  }

  run() {
    this.on('start', this.onStart);
    this.on('message', this.onMessage);
  }

  onStart() {
    this.loadBotUser();
    this.connectDb();
    // this.firstRunCheck();
  }

  loadBotUser() {
    const self = this;
    this.user = this.users.filter(user => user.name === self.name)[0];
  }

  connectDb() {
    if (!fs.existsSync(this.dbPath)) {
      console.error(`${'Database path ' + '"'}${this.dbPath}" does not exists or it's not readable.`);
      process.exit(1);
    }

    this.db = new SQLite.Database(this.dbPath);
  }

  /**
  * getRoomDetails - Description
  *
  * @returns {type} Description
  */
  getRoomDetails() {
    self.db.get('SELECT * FROM meetingRooms', function (err, records) {
      if (err) {
        return console.error('DATABASE ERROR:', err);
      }
      this.meetingRoomDetails = records;
    });
  }

  welcomeMessage() {
    this.postMessageToChannel(this.channels[0].name, 'Hi', { as_user: true });
  }

  onMessage(message) {
    if (this.isChatMessage(message) && this.isChannelConversation(message) && !this.isFromxBot(message)) {
      this.isMentioningAMeetingRoom(message).then(roomDetails => this.replyWithDescription(message, roomDetails.description));
    }
    if (this.isChatMessage(message) && this.isConversationWithXbot(message) && !this.isFromxBot(message)) {
      this.performRequestToXbot(message);
    }
  }

  isChatMessage(message) {
    return message.type === 'message' && Boolean(message.text);
  }

  isChannelConversation(message) {
    return typeof message.channel === 'string' && message.channel[0] === 'C';
  }

  isConversationWithXbot(message) {
    const botId = this.self.id;
    const channelId = message.channel;
    return botId.substr(1, botId.length - 3) === channelId.substr(1, channelId.length - 3);
  }

  isFromxBot(message) {
    return message.user === this.user.id;
  }

  needsSomeonesLocation(message) {
    return message.text.toLowerCase().indexOf('xbot where is');
  }

  isMentioningAMeetingRoom(message) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM meetingRooms WHERE '${message.text}' LIKE '%'|| roomName ||'%'`, (err, records) => {
        if (err) {
          return console.error('DATABASE ERROR:', err);
        }
        resolve(records);
      });
    });
  }

  replyWithDescription(originalMessage, roomDetails) {
    const self = this;
    // var channel = self.getChannelById(originalMessage.channel);
    if (roomDetails) {
      return self.postMessage(originalMessage.channel, this.draftLocationDescription(roomDetails, 'meeting'), { as_user: true });
    }
  }

  replyToPrivateChat(originalMessage, replyMessage) {
    console.log(originalMessage, replyMessage);
    return this.postMessage(originalMessage.user, replyMessage, { as_user: true });
    // const channel = self.getChannelById(originalMessage.channel);
    // this.postMessageToUser(channel.name, record.location, { as_user: true });
  }

  draftLocationDescription(description, type) {
    switch (type) {
    case 'meeting':
      return description;
    }
  }

  getChannelById(channelId) {
    return this.channels.filter(item => item.id === channelId)[0];
  }

  checkRequestType(message) {
    if (message.text.split(/^where is/)[1] || message.text.split(/^xwi/)[1]) {
      return this.extractRequest(message, 'where is', 'xwi');
    }
    if (message.text.split(/^add me/)[1] || message.text.split(/^xam/)[1]) {
      return this.extractRequest(message, 'add me', 'xam');
    }
    if (message.text.split(/^update me/)[1] || message.text.split(/^xum/)[1]) {
      return this.extractRequest(message, 'update me', 'xum');
    }
    if (message.text.split(/^am at/)[1] || message.text.split(/^xat/)[1]) {
      return this.extractRequest(message, 'am at', 'xat');
    }
  }

  extractRequest(message, keyword, shortKeyword) {
    const rKeyword = new RegExp(`^${keyword}`);
    const rShortKeyword = new RegExp(`^${shortKeyword}`);
    const details = message.text.split(rKeyword) || message.text.split(rShortKeyword);
    details[1] = details[1].trim();
    details[1] = keyword === 'where is' ? details[1].substring(2, details[1].length - 1) : details[1];
    const res = {
      type: keyword,
      details: details[1]
    };
    return res;
  }

  performRequestToXbot(message) {
    const self = this;
    const response = this.checkRequestType(message);
    switch (response.type) {
    case 'where is':
    case 'xwi': return this.replyWhereIs(message, response.details);
    case 'xam':
    case 'add me': return this.addNewUser(message, response.details);
    case 'xum':
    case 'update me': return this.updateUser(message, response.details);
    case 'xat':
    case 'am at': return this.updatepresentLocation(message, response.details);

    }
  }

  replyWhereIs(message, userToFind) {
    const self = this;
    this.db.get(`SELECT * FROM usersLocation WHERE userId = '${userToFind}'`, (err, records) => {
      if (err) {
        return console.error('DATABASE ERROR:', err);
      }
      if (records) {
        const description = `Last Seen: ${records.lastUpdated} @ ${records.lastUpdatedLocation}`;
        return self.replyWithDescription(message, description);
      }
    });
  }

  addNewUser(message, userLocation) {
    const self = this;
    const todaysDate = moment().format('MMM D YYYY');
    this.db.run(`INSERT INTO usersLocation (userId, permanentLocation, lastUpdatedLocation, lastUpdated) values ('${message.user}', '${userLocation}', '${userLocation}', '${todaysDate}')`, (err, records) => {
      let description;
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return (description = 'Your Location is already set');
        }
        return console.error('DATABASE ERROR:', err);
      }
      description = `You Have been Added
         Your Desk: ${userLocation}
         Last Seen: ${todaysDate} @ ${userLocation}`;
      return self.replyToPrivateChat(message, description);
    });
  }

  updateUser(message, userLocation) {
    const self = this;
    const todaysDate = moment().format('MMM D YYYY');
    this.db.run(`UPDATE usersLocation SET permanentLocation = '${userLocation}' WHERE userId = '${message.user}'`, (err, records) => {
      let description;
      if (err) {
        description = 'Sorry! I could not update for some reason';
        return console.error('DATABASE ERROR:', err);
      }
      description = `Your Desk Location has been Updated
         Your Desk: ${userLocation}`;
      return self.replyToPrivateChat(message, description);
    });
  }

  updatePresentLocation(message, userLocation) {
    const self = this;
    const todaysDate = moment().format('MMM D YYYY');
    this.db.run(`UPDATE usersLocation SET permanentLocation = '${userLocation}' WHERE userId = '${message.user}'`, (err, records) => {
      let description;
      if (err) {
        description = 'Sorry! I could not update for some reason';
        return console.error('DATABASE ERROR:', err);
      }
      description = `Your Desk Location has been Updated
         Your Desk: ${userLocation}`;
      return self.replyToPrivateChat(message, description);
    });
  }

  }
module.exports = xBot;
