const redisIp = '192.168.217.132';
const redisPort = '6379';
const express = require('express');
const { mainModule } = require('process');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
	'cors': {
		"origin" : "http://localhost:3000",
		"methods" : "GET,HEAD,PUT,PATCH,POST,DELETE",
		"credentials" : true
	},
	'allowEIO3': true // false by default
});
const redis = require('socket.io-redis');

server.listen(3000, function() {
	console.log('listening on *:3000');
});

app.use('/res', express.static(__dirname + '/public'));

// main page
app.get('/', function(req, res) {
	res.sendFile(__dirname + '/view/index.html');
});

// TODO : Adapting Redis
//io.adapter(redis({ host: redisIp, port: redisPort }));

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
		console.log('>>>> roomList response data', roomList);
		io.emit('roomList', roomList);
	});

	// Enter room
	socket.on('enterRoom', (data) => {
		// console.log('>>> enterRoom param : ', data);
		var roomId = data.roomId ? data.roomId : 'room' + Math.floor(Math.random() * 1000) + 1;
		
		socket.username = data.username;
		socket.join(roomId);
		console.log('>>> Entered room : ', roomId);

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
		console.log('>>> [chat] parameter : ', data);
		let roomId = data.roomId;
		let from = data.from;
		let to = data.to;
		let message = data.msg;

		const fromUser = io.of("/").sockets.get(from);
		const toUser = to != null ? io.of("/").sockets.get(to) : null;
		
		// console.log("fromUser", fromUser);
		// console.log("toUser", toUser);
		
		var response = {
			'type' : to == null ? 'message' : 'whisper',
			'from' : from,
			'fromName' : fromUser.username,
			'to' : to,
			'toName' : toUser != null ? toUser.username : null,
			'msg' : message,
			'time' : Date.now()
		};
		console.log('>>> [chat] response : ', response);

		var target = to != null ? to : roomId;
		console.log('>>> [chat] target', target);
		socket.to(target).emit('chat_recv', response);
		// io.to(roomId).emit('chat_recv', response);
	});

	// Transfer image binary
	socket.on('image', function(data) {
		console.log('>>> [image] parameter : ', data);
		let roomId = data.roomId;
		let image = data.image;
		const senderSocket = io.of("/").sockets.get(data.sender);

		var imageData = {
			'sender' : data.sender,
			'senderName' : senderSocket.username,
			'buffer' : image.toString('base64'),
			'time' : Date.now()
		};
		var target = to != null ? to : roomId;
		console.log(">>> [image] target : ", target);
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
		console.log(">>> [exitRoom] parameter : ", roomId);
		socket.leave(roomId);
		console.log(">>> [exitRoom] socket info : ", socket.id, socket.username);

		var userList = io.sockets.adapter.rooms.get(roomId);  // Set Object, Room participant list.

		var userInfoList = [];
		if (typeof userList != 'undefined' ) {
			userList.forEach((value) => {
				let socketData = io.of("/").sockets.get(value);
				let userInfo = {
					'userId' : value,
					'username' : socketData.username
				};
				userInfoList.push(userInfo);
			});
		}
		
		io.emit('exitRoom', userInfoList);
	});
});
