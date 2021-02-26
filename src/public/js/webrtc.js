var WebRTC = {

	peerConnectionMap : {},

	mediaConst : {
		audio : true,
		video : { mandatory: { maxWidth: 640, maxHeight: 360 }}
	},

	myPeerConnection : null,

	// Google Stun/Turn Server
	peerConnectionParams : {
		iceServers : [
			{ 'urls': 'stun:stun.l.google.com:19302' },
			{ 'urls': 'turn:192.158.29.39:3478?transport=udp',
			  'credential': 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
			  'username': '28224511:1379330808' },
			{ 'urls': 'turn:192.158.29.39:3478?transport=tcp',
			  'credential': 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
			  'username': '28224511:1379330808' }
		]
	},

	getUserMedia : function(localVideoElem) {
		navigator.mediaDevices.getUserMedia(this.mediaConst).then(function(localStream) {
			localVideoElem.srcObject = localStream;
		});
	},

	createPeerConnection : function () {
		myPeerConnection = new RTCPeerConnection(this.peerConnectionParams);
	},

	createRemotePeerConnection : function(nickname) {
		var peerConnection = new RTCPeerConnection(this.peerConnectionParams);
		peerConnection.onaddstream = function(event) {

		};
		peerConnection.onicecandidate = function(event) {

		};
		peerConnection.oniceconnectionstatechange = function(event) {
            console.log(event);
        }
		peerConnection.onnegotiationneeded = function(event) {
        	console.log("peerConnection.onnegotiationneeded", event);
		};
        peerConnection.onremovestream = function(event) {
        	console.log("peerConnection.onremovestream", event);
		};
		peerConnection.onstatechange = function(event) {
            console.log("peerConnection.onstatechange event.currentTarget.readyState : " + event.currentTarget.readyState);
            console.log("peerConnection.onstatechange event.currentTarget.iceState : " + event.currentTarget.iceState);
        };

		peerConnectionMap["nickname"] = peerConnection;
	},

	createOffer : function(callback) {
		myPeerConnection.createOffer(function (localSdp) {
			myPeerConnection.setLocalDescription(localSdp);
			callback();
		});
		// TODO : send My localSdp to remote peer
	},

	createAnswer : function(callback) {
		myPeerConnection.createAnswer(function (localSdp){
			myPeerConnection.setLocalDescription(localSdp);
			callback();
		});

		// TODO : send My localSdp to remote peer
	}

}