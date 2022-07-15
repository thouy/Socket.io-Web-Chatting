const redisIp = '127.0.0.1';
const redisPort = '6379';
const express = require('express');
const { mainModule } = require('process');
const fetch = require('node-fetch')
const cheerio = require('cheerio');

const app = express();
const server = require('http').createServer(app);

const ifaces = require('os').networkInterfaces();
let address;
Object.keys(ifaces).forEach(dev => {
	ifaces[dev].filter(details => {
		if (details.family === 'IPv4' && details.internal === false) {
			address = details.address;
		}
	});
});

const io = require('socket.io')(server, {
	'cors': {
		'origin'  : "http://" + address + ":3000",
		'methods' : "GET,HEAD,PUT,PATCH,POST,DELETE",
		'credentials' : true
	},
	'allowEIO3': true // false by default
});
const redis = require('socket.io-redis');

server.listen(3000, function() {
	console.log(address);
	console.log('listening on *:3000');
});

app.use('/res', express.static(__dirname + '/public'));

// main page
app.get('/', function(req, res) {
	res.sendFile(__dirname + '/view/index.html');
});

// TODO : Adapting Redis
io.adapter(redis({ host: redisIp, port: redisPort }));

io.on('connection', function(socket) {
	
	// TODO : Make room
	// socket.on('makeRoom', function(data) {
	// 	var roomId = 'room' + Math.floor(Math.random() * 1000) + 1;
	// 	socket.join(roomId);
	// });

	// Broadcast room list in lobby
	socket.on('roomList', function() {
		var roomList = [];
		io.sockets.adapter.rooms.forEach(function(value, key, map) {
			if (key.indexOf('room') == 0)
				roomList.push(key)
		});
		console.log('>> [roomList] response : ', roomList);
		io.emit('roomList', roomList);
	});

	// Enter room
	socket.on('enterRoom', (data) => {
		console.log('>>> [enterRoom] parameter : ', data);
		var roomId = data.roomId ? data.roomId : 'room' + Math.floor(Math.random() * 1000) + 1;
		
		socket.username = data.username;
		socket.join(roomId);
		console.log('>>> [enterRoom] roomId : ', roomId);

		var userList = io.sockets.adapter.rooms.get(roomId);  // Set Object, Room participant list.
		var userInfoList = [];
		userList.forEach(function(value) {
			let socketData = io.of("/").sockets.get(value);
			let userInfo = {
				'userId' : value,
				'username' : socketData.username
			};
			userInfoList.push(userInfo);
		});

		var data = {
			'roomId' : roomId,
			'roomPaticipant' : userInfoList,
			'userId' : socket.id,
			'username' : data.username
		};

		io.sockets.in(roomId).emit('enterRoom', data);
		io.sockets.in(roomId).emit('userlist', userInfoList);    // 참여자 리스트 브로드캐스팅
	});

	// Transfer text
	socket.on('chat', (data) => {
		console.log('>>>>> [chat] parameter : ', data);
		let roomId = data.roomId;
		let from = data.from;
		let to = data.to;
		let message = data.msg;

		const fromUser = io.of("/").sockets.get(from);
		const toUser = to != null ? io.of("/").sockets.get(to) : null;
		
		var target = to != null ? to : roomId;
		
		// console.log("fromUser", fromUser);
		// console.log("toUser", toUser);
		

		let regex = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
		let metadata = {};
		if (regex.test(message)) {
			console.log(">>>>> URL string contained..")
			url = message.match(regex)
			console.log('url', url);
			urlScrapper(url[0]).then((htmlStr) => {
				//console.log(htmlStr);
				metadata = scrapMetaTag(htmlStr);
				console.log(metadata);

				if (Object.keys(metadata).length > 0) {
					var metadataResponse = {
						title : metadata['og:title'],
						url   : metadata['og:url'],
						image : metadata['og:image'],
						description : metadata['og:description'],
					}
					console.log('>>>>> [metadata_recv > emit()] target', target);
					socket.to(target).emit('metadata_recv', metadataResponse);
				}
			});
		}

		

		var response = {
			'type' : to == null ? 'message' : 'whisper',
			'from' : from,
			'fromName' : fromUser.username,
			'to' : to,
			'toName' : toUser != null ? toUser.username : null,
			'msg' : message,
			'time' : Date.now()
		};
		console.log('>>>>> [chat] response : ', response);

		
		console.log('>>>>> [chat_recv > emit()] target', target);
		socket.to(target).emit('chat_recv', response);
		// io.to(roomId).emit('chat_recv', response);
	});

	// Transfer image binary
	socket.on('image', (data) => {
		console.log('>>>>>> [image] parameter : ', data);
		let roomId = data.roomId;
		let image = data.image;
		const senderSocket = io.of("/").sockets.get(data.sender);

		var imageData = {
			'sender' : data.sender,
			'senderName' : senderSocket.username,
			'buffer' : image.toString('base64'),
			'time' : Date.now()
		};
		//var target = to != null ? to : roomId;
		var target = roomId;
		console.log(">>>>>> [image] target : ", target);
		socket.to(target).emit('image_recv', imageData);
	});

	// WebRTC 시그널링 처리용
	socket.on('signal', function(data) {
		var signalType = data.type;
		var fromUser = data.from;
		var toUser = data.to;
		var toSocketId;
		
		var userList = roomList[roomId].users;
		
		userList.forEach(function(element, index) {
			if (element.nickname == to) {
				toSocketId = element.id;
			}
		});
		
		var signalData = {
			'type' : signalType,
			'from' : fromUser,
			'to'   : toUser,
			'msg'  : data.msg
		};
		
		socket.to(toSocketId).emit('signal', whisperData);
	});
	
	// Exit room
	socket.on('exitRoom', function(roomId) {
		console.log(`>>>>>>>>> [exitRoom] parameter : ${roomId}`);
		socket.leave(roomId);
		console.log(`>>>>>>>>> [exitRoom] socket.id : ${socket.id} socket.username : ${socket.username}`);

		var userList = io.sockets.adapter.rooms.get(roomId);  // Set Object, Room participant list.

		var response = [];
		if (typeof userList != 'undefined' ) {
			userList.forEach((value) => {
				let socketData = io.of("/").sockets.get(value);
				let userInfo = {
					'userId' : value,
					'username' : socketData.username
				};
				response.push(userInfo);
			});
		}
		console.log(">>>>>>>>> [exitRoom] response : ", response)
		io.emit('exitRoom', response);
	});
});

async function urlScrapper(url) {
	const response = await fetch(url);
	const data = await response.text();
	return data;
}

function scrapMetaTag(htmlStr) {
	const $ = cheerio.load(htmlStr);
	const meta = $('meta');
	const metaData = {};
	Object.keys(meta).forEach((key) => {
		if(meta[key].attribs !== undefined){
			if(meta[key].attribs.property && meta[key].attribs.content){
				metaData[meta[key].attribs.property] = meta[key].attribs.content;
			}
			if(meta[key].attribs.name && meta[key].attribs.content){
				metaData[meta[key].attribs.name] = meta[key].attribs.content;
			}
		}
	});
	return metaData;
}