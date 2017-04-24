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
      return self.postMessage(originalMessage.channel, this.draftLocationDescription(roomDetails, 'meeting'), { as_user: true, attachments: roomDetails.attachments });
    }
  }

  replyToPrivateChat(originalMessage, replyMessage) {
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
    if (message.text.split(/^where is item/)[1] || message.text.split(/^xwii/)[1]) {
      return this.extractRequest(message, 'where is item', 'xwii');
    }
    if (message.text.split(/^where is room/)[1] || message.text.split(/^xwir/)[1]) {
      return this.extractRequest(message, 'where is room', 'xwir');
    }
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
    if (message.text.split(/^add room/)[1] || message.text.split(/^xar/)[1]) {
      return this.extractRequest(message, 'add room', 'xar');
    }
    if (message.text.split(/^update room/)[1] || message.text.split(/^xur/)[1]) {
      return this.extractRequest(message, 'update room', 'xur');
    }
    if (message.text.split(/^add item/)[1] || message.text.split(/^xai/)[1]) {
      return this.extractRequest(message, 'add item', 'xai');
    }
    if (message.text.split(/^update item/)[1] || message.text.split(/^xui/)[1]) {
      return this.extractRequest(message, 'update item', 'xui');
    }
  }

// update room
// Idanre description Idanre is located at the first place you can see
// Idanre ImageUrl http://sdasas.png
  extractRequest(message, keyword, shortKeyword) {
    const rKeyword = new RegExp(`^${keyword}`);
    const rShortKeyword = new RegExp(`^${shortKeyword}`);
    const details = message.text.split(rKeyword) || message.text.split(rShortKeyword);
    details[1] = details[1].trim();
    details[1] = keyword === 'where is' ? details[1].substring(2, details[1].length - 1) : details[1];

    if (keyword === 'add room' || keyword === 'add item') {
      const theDetails = details[1].split('description');
      details[1] = {
        roomName: theDetails[0].trim(),
        description: theDetails[1].trim(),
      };
    }

    if (keyword === 'update room' || keyword === 'update item') {
      let param = 'description';
      const theDetails = details[1].indexOf('description') > -1 ? details[1].split('description') : (param = 'imageUrl', details[1].split('imageurl'));
      details[1] = {
        roomName: theDetails[0].trim(),
        param,
        description: theDetails[1].trim(),
      };
    }

    const res = {
      type: keyword,
      details: details[1]
    };
    return res;
  }

  performRequestToXbot(message) {
    const self = this;
    const response = this.checkRequestType(message);
    if (!response) {
      this.showHelp(message);
    }
    switch (response.type) {
    case 'where is item':
    case 'xwii': return this.replyWhereIs(message, response.details, 'item');
    case 'where is room':
    case 'xwir': return this.replyWhereIs(message, response.details, 'room');
    case 'where is':
    case 'xwi': return this.replyWhereIs(message, response.details);
    case 'xam':
    case 'add me': return this.addNewUser(message, response.details);
    case 'xar':
    case 'add room': return this.addNewRoom(message, response.details);
    case 'xai':
    case 'add item': return this.addNewItem(message, response.details);
    case 'xum':
    case 'update me': return this.updateUser(message, response.details);
    case 'xur':
    case 'update room': return this.updateRoom(message, response.details);
    case 'xui':
    case 'update item': return this.updateItem(message, response.details);
    case 'xat':
    case 'am at': return this.updatePresentLocation(message, response.details);
    default: return this.showHelp(message);
    }
  }

  showHelp(message) {
    const description = `xBot Help:
      add me <your desk location> or xam <your desk location> : Adds your Desk location so that friends can find you
      add room description <A Meeting Room location> or xam <your desk location> : Adds a meeting Room location so that friends can find you
      update me <your desk location> or xum <your desk location> : Updates your Desk location so that friends can find you
      am at <your desk location> or xat <your location> : Share your present location
      where is <your desk location> or xwi <slack username> : Find out a friend's location`;
    return this.replyToPrivateChat(message, description);
  }

  replyWhereIs(message, userToFind, selector) {
    const self = this;
    let whereToSearch;
    let constraint;
    switch (selector) {
    case 'room': whereToSearch = 'meetingRooms'; constraint = 'roomName';
      break;
    case 'item': whereToSearch = 'itemsLocation'; constraint = 'itemName';
      break;
    default: whereToSearch = 'usersLocation'; constraint = 'userId';
    }

    this.db.get(`SELECT * FROM ${whereToSearch} WHERE ${constraint} = '${userToFind}'`, (err, records) => {
      if (err) {
        return console.error('DATABASE ERROR:', err);
      }
      if (records) {
        let description;
        switch (selector) {
        case 'room':
          description = {
            attachments: [
              {
                title: 'Meeting Room Location Details',
                title_link: `${records.imageUrl.replace(/^<|>$/, '')}`,
                text: `Location: ${records.description} \n visuals: click here ${records.imageUrl}`,
                color: '#7CD197',
                image_url: `${records.imageUrl.replace(/^<|>$/, '')}`,
                thumb_url: `${records.imageUrl.replace(/^<|>$/, '')}`,
              }
            ]
          };

          break;
        case 'item':
          description = `Location: ${records.description}
          visuals: click here ${records.imageUrl}`;
          break;
        default: description = `His Desk: ${records.permanentLocation}
        Last Seen: ${records.lastUpdatedLocation} @ ${records.lastUpdated}`;
        }
        return self.replyWithDescription(message, description);
      }
    });
  }

  addNewUser(message, userLocation) {
    const self = this;
    const todaysDate = moment().format('MMM D YYYY h:mm:ss a');
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
    const todaysDate = moment().format('MMM D YYYY h:mm:ss a');
    this.db.run(`UPDATE usersLocation SET lastUpdatedLocation = '${userLocation}', lastUpdated='${todaysDate}' WHERE userId = '${message.user}'`, (err, records) => {
      let description;
      if (err) {
        description = 'Sorry! I could not update for some reason';
        return console.error('DATABASE ERROR:', err);
      }
      description = `Your Curent Location has been Updated
         Current Location: ${userLocation} as @ ${todaysDate}`;
      return self.replyToPrivateChat(message, description);
    });
  }

  addNewRoom(message, roomDetails) {
    const self = this;
    this.db.run(`INSERT INTO meetingRooms (roomName, description) values ('${roomDetails.roomName}', '${roomDetails.description}')`, (err, records) => {
      let description;
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          description = 'This Room has is already Added';
          return self.replyToPrivateChat(message, description);
        }
        return console.error('DATABASE ERROR:', err);
      }
      description = `Meeting Room has been Added
         Meeting Room: ${roomDetails.roomName}
         Description: ${roomDetails.description}`;
      return self.replyToPrivateChat(message, description);
    });
  }

  updateRoom(message, roomDetails) {
    const self = this;
    this.db.run(`UPDATE meetingRooms SET ${roomDetails.param} = '${roomDetails.description}' WHERE roomName = '${roomDetails.roomName}'`, (err, records) => {
      let description;
      if (err) {
        description = 'Sorry! I could not update for some reason';
        return console.error('DATABASE ERROR:', err);
      }
      description = `Your Meeting Details has been Updated
         Meeting Name : ${roomDetails.roomName}
         ${roomDetails.param}:  ${roomDetails.description}`;
      return self.replyToPrivateChat(message, description);
    });
  }

  addNewItem(message, itemDetails) {
    const self = this;
    this.db.run(`INSERT INTO itemsLocation (itemName, description) values ('${itemDetails.roomName}', '${itemDetails.description}')`, (err, records) => {
      let description;
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          description = 'This Item has is already Added';
          return self.replyToPrivateChat(message, description);
        }
        return console.error('DATABASE ERROR:', err);
      }
      description = `Item has been Added
         Item Name: ${itemDetails.roomName}
         Description: ${itemDetails.description}`;
      return self.replyToPrivateChat(message, description);
    });
  }

  updateItem(message, itemDetails) {
    const self = this;
    this.db.run(`UPDATE itemsLocation SET ${itemDetails.param} = '${itemDetails.description}' WHERE itemName = '${itemDetails.roomName}'`, (err, records) => {
      let description;
      if (err) {
        description = 'Sorry! I could not update for some reason';
        return console.error('DATABASE ERROR:', err);
      }
      description = `Your Item Details has been Updated
         Item Name : ${itemDetails.roomName}
         ${itemDetails.param}:  ${itemDetails.description}`;
      return self.replyToPrivateChat(message, description);
    });
  }

  }
module.exports = xBot;
