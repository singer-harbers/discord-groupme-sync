//enter your info for discord channel and groupme bot
var channelID = "[discord channel id]";
var groupmeGroupId = "[groupme group id]";
var groupmeToken = "[groupme token]";
var groupmeBotId= "[groupme bot id]";
var groupmeBotName = "[groupme bot name]";
var discordBotName = "[discordBotName]";

//setting up dependencies
var request = require('request');
var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json'); //token for discord bot

//setting up constants
var messages = [];
var lastId = '0';

//url for getting mostrecet messages from groupme
var ip = "https://api.groupme.com/v3/groups/" + groupmeGroupId + "/messages?token=" + groupmeToken;


//setting up logger
logger.remove(logger.transports.Console); // ties the logger to the console

logger.add(new logger.transports.Console, {
  colorize: true
});

logger.level = 'debug';
var bot = new Discord.Client({
  token: auth.token,
  autorun: true
});

//innital call to groupme server to find innital messages
request.get({
  url: ip
}, function optionalCallback(err, httpResponse, body) {
  if (err) {
    logger.info('upload failed:', err);
  } else {
//parse the response
//groupme api responds with 20 most recent messages by default however this can be increased if you
//check less frequently
    var res = JSON.parse(body);
    //stores the id of most resent message inorder to identify new groupme messages
    lastId = res.response.messages[0].id;
    logger.info("last messsage id is:  " + lastId);
    }
});

//initial connection to the discord api
bot.on('ready', function (evt) {
  logger.info('Connected');
  logger.info('Logged in as: ');
  logger.info(bot.username + ' – (' + bot.id + ')');
});

//runs continuously inorder to recognise new groupme messages
function update(){

	//connect to the discord api
  bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' – (' + bot.id + ')');
  });


  //sends a http get request to groupme api
  request.get({
    url: ip
  }, function optionalCallback(err, httpResponse, body) {
    if (err) {
      logger.info('upload failed:', err);
    } else {
      	//parse the response from groupme api
      var res = JSON.parse(body);
	//finding if there are new messages
      if(res.response.messages && res.response.messages.length > 0){
        if (lastId != res.response.messages[0].id){

          var counter = 0;
  	//while the message being read is not the last message known by the server
          while(res.response.messages[counter].id != lastId){
            counter ++;
          }

  //all messages need to be added to a list and then the print() function sends all messages in the list to discord
  //this is because if you send multiple messages at the same time to discord the messages will become mixed up
  //and some messages may become lost
  //therefore inorder to prevent this the program is limited to only sending one message every second


  //runs for every new message
          for(var i = counter -1; i >=0; i --){
  	//finds the name and text of most recent messages
    //preventing bot reading its own messages causing an infinie loop
            if(res.response.messages[i].name != discordBotName && res.response.messages[i].text != "undefined"){
              var name = res.response.messages[i].name;
              var text = res.response.messages[i].text;

              //finds weather the message is alread the url of the attachment
              var sendMes = true;
              //finding all the attachments
              for(var j = 0; j < res.response.messages[i].attachments.length; j ++){
                if(name != discordBotName){
                  logger.info("sending attachment from " + name + " with url " + res.response.messages[i].attachments[j].url);
                   //sending the attachment link
                  messages.push(name + ":  " + res.response.messages[i].attachments[j].url);
                  //will not send message if it is the same as the attachment url which tends to be true for videos and some other attachments
                  if(res.response.messages[i].attachments[j].url == text){
                    sendMes = false;
                  }
                }
              }


              logger.debug("message id:  " + res.response.messages[i].id);
  	//adds the text to a list
              if(res.response.messages[i].text && sendMes){
                messages.push(name + ":  " + text);
              }
            }
          }

  	//resets the most recent message known by the server
          lastId = res.response.messages[0].id;
  	//runs the print() function which will send all the messages in the "messages" list at one second intervals

          print();
        }
      }
    }
  });
//restarts the function inorder to keep checking in with the groupme api
//the time is set to 1s however can be made slower to reduce bandwidth and requests
//however if this is set too long you may risk loosing messages if many are sent in a short period of time
  setTimeout(update, 1000);
}


//url for posting messages to groupme
var postURL = 'https://api.groupme.com/v3/bots/post';

//is called whenever a message is sent on a channel that the bot can see
bot.on('message', function (user, userID, channelID, message, evt) {
  logger.info("message:  " + user + ":  " + message);
	//preventing bot sending its own messages in a repeating loop
  if(user != groupmeBotName){

    //will run for every attachment sent
    for(var j = 0; j < evt.d.attachments.length; j++){
      //sends a form with the user and the attachment url
      var formData = {
        "bot_id"  : groupmeBotId,
        "text"    : bot.servers[bot.channels[channelID].guild_id].members[userID].nick + ":  " + evt.d.attachments[j].proxy_url
        }
      //sends a http post request inorder to post the attachment to groupme
      request.post({
        url: postURL,
        formData: formData
      }, function optionalCallback(err, httpResponse, body) {
        if (err) {
          logger.info('upload failed:', err);
        }
      });
    }

    if(message != "" && message != "undefined"){
      var formData = {
        "bot_id"  : groupmeBotId,
        "text"    : bot.servers[bot.channels[channelID].guild_id].members[userID].nick + ":  " + message
        }
  		//sends a http post request inorder to post the message to groupme
      request.post({
        url: postURL,
        formData: formData
      }, function optionalCallback(err, httpResponse, body) {
        if (err) {
          logger.info('upload failed:', err);
        }
      });
    }
  }
});

//starts the update function loop
setTimeout(update, 1000);

//print function is responsible for sending messages in a controlled way to discord inorder to prevent
//lost messages and messages ariving in the wrong order
function print(){

  logger.debug("about to print  " + messages[0]);
	//while there are still messages to send
  if(messages.length > 0){
		//using discord api to send messages to specified channel
  	bot.sendMessage({
      to: channelID,
      message: messages[0]
    });
		//remove the send message from the global lsit
    messages.shift();
		//restart function with time delay before next message is sent
    setTimeout(function(){print()}, 1000);
    }
}

