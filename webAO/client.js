/*
 * Glorious webAO
 * made by sD, refactored by oldmud0
 * credits to aleks for original idea and source
*/

let queryDict = {};
location.search.substr(1).split("&").forEach(function(item) {
	queryDict[item.split("=")[0]] = item.split("=")[1]
});

/* Server magic */

const serverIP = queryDict.ip;
let mode = queryDict.mode;

const AO_HOST = queryDict.asset || "http://assets.aceattorneyonline.com/base/";
const MUSIC_HOST = AO_HOST + "sounds/music/";
const BAR_WIDTH = 90;
const BAR_HEIGHT = 20;
const CHAR_SELECT_WIDTH = 8;
const UPDATE_INTERVAL = 60;

let oldLoading = false;
if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(navigator.userAgent)) {
	oldLoading = true;
}

let selectedEffect = 0;
let selectedMenu = 1;
let selectedShout = 0;
let lastICMessageTime = new Date(0);

class Client {
	constructor(address) {
		this.serv = new WebSocket("ws://" + address);

		this.serv.onopen    = (evt) => this.onOpen(evt);
		this.serv.onclose   = (evt) => this.onClose(evt);
		this.serv.onmessage = (evt) => this.onMessage(evt);
		this.serv.onerror   = (evt) => this.onError(evt);
		
		this.flip = false;
		this.presentable = false;
		
		this.hp = [0,0];

		this.playerID = 1;
		this.charID = -1;
		this.testimonyID = 0;

		this.chars = [];
		this.emotes = [];		
		this.evidences = [];
		
		this.resources = {
			"holdit":{
				"src": "misc/holdit.gif",
				"duration": 720
			},
			"objection":{
				"src": "misc/objection.gif",
				"duration": 720
			},
			"takethat":{
				"src": "misc/takethat.gif",
				"duration": 840
			},
			"witnesstestimony":{
				"src": "misc/witnesstestimony.gif",
				"duration": 1560,
				"sfx": "sounds/general/sfx-testimony.wav"
			},
			"crossexamination":{
				"src": "misc/crossexamination.gif",
				"duration": 1600,
				"sfx": "sounds/general/sfx-testimony2.wav"
			}
		};

		this.selectedEmote = -1;
		this.selectedEvidence = 0;

		this.checkUpdater = null;

		// Only used for RMC/`music` packets, not EM/SM/MC packets.
		this.musicList = Object();

		this.handlers = {
			"MS":         (args) => this.handleMS(args),
			"CT":         (args) => this.handleCT(args),
			"MC":         (args) => this.handleMC(args),
			"RMC":        (args) => this.handleRMC(args),
			"CI":         (args) => this.handleCI(args),
			"SC":         (args) => this.handleSC(args),
			"EI":         (args) => this.handleEI(args),
			"LE":         (args) => this.handleLE(args),
			"EM":         (args) => this.handleEM(args),
			"SM":         (args) => this.handleSM(args),
			"music":      (args) => this.handlemusic(args),
			"DONE":       (args) => this.handleDONE(args),
			"BN":         (args) => this.handleBN(args),			
			"NBG":        (args) => this.handleNBG(args),
			"HP":         (args) => this.handleHP(args),
			"RT":         (args) => this.handleRT(args),
			"ZZ":         (args) => this.handleZZ(args),
			"ID":         (args) => this.handleID(args),
			"PN":         (args) => this.handlePN(args),
			"SI":         (args) => this.handleSI(args),
			"CharsCheck": (args) => this.handleCharsCheck(args),
			"PV":         (args) => this.handlePV(args),
			"CHECK":      (args) => {}
		}

		this._lastTimeICReceived = new Date(0);
	}

	/**
	 * Gets the current player's character.
	 */
	me() {
		return this.chars[this.charID];
	}

	/**
	 * Gets the player's currently selected emote.
	 */
	myEmote() {
		return this.emotes[this.selectedEmote];
	}
	
	/**
	 * Gets the player's currently selected evidence if presentable.
	 */
	myEvidence() {
		return (this.presentable)? this.selectedEvidence : 0;
	}

	/**
	 * Sends an out-of-character chat message.
	 * @param {string} message the message to send
	 */
	sendOOC(message) {
		this.serv.send(`CT#${escapeChat(encodeChat(document.getElementById("OOC_name").value))}#${escapeChat(encodeChat(message))}#%`);
	}

	/**
	 * Sends an in-character chat message.
	 * @param {string} speaking who is speaking
	 * @param {string} name the name of the current character
	 * @param {string} silent whether or not it's silent
	 * @param {string} message the message to be sent
	 * @param {string} side the name of the side in the background
	 * @param {string} ssfxname the name of the sound effect
	 * @param {string} zoom whether or not to zoom
	 * @param {string} ssfxdelay the delay (in milliseconds) to play the sound effect
	 * @param {string} objection the number of the shout to play
	 */
	sendIC(speaking, name, silent, message, side, ssfxname, zoom, ssfxdelay, objection, evidence, flip, flash, color) {
		this.serv.send(
			`MS#chat#${speaking}#${name}#${silent}` +
			`#${escapeChat(encodeChat(message))}#${side}#${ssfxname}#${zoom}` +
			`#${this.charID}#${ssfxdelay}#${selectedShout}#${evidence}#${flip}#${flash}#${color}#%`
		);
	}
	
	/**
	 * Sends add evidence command.
	 * @param {string} evidence name
	 * @param {string} evidence description
	 * @param {string} evidence image filename
	 */
	sendPE(name, desc, img) {
		this.serv.send(`PE#${escapeChat(encodeChat(name))}#${escapeChat(encodeChat(desc))}#${img}#%`);
	}
	
	/**
	 * Sends edit evidence command.
	 * @param {string} evidence id
	 * @param {string} evidence name
	 * @param {string} evidence description
	 * @param {string} evidence image filename
	 */
	sendEE(id, name, desc, img) {
		this.serv.send(`EE#${id}#${escapeChat(encodeChat(name))}#${escapeChat(encodeChat(desc))}#${img}#%`);
	}
	
	/**
	 * Sends delete evidence command.
	 * @param {string} evidence id
	 */
	sendDE(id) {
		this.serv.send(`DE#${id}#%`);
	}
	
	/**
	 * Sends health point command.
	 * @param {int} side the position
	 * @param {int} hp the health point
	 */
	sendHP(side,hp) {
		this.serv.send(`HP#${side}#${hp}#%`);
	}
	
	/**
	 * Sends call mod command.
	 * @param {string} message to mod
	 */
	sendZZ(msg) {
		this.serv.send(`ZZ#${msg}#%`);
	}
	
	/**
	 * Sends testimony command.
	 * @param {string} testimony type
	 */
	sendRT(testimony) {
		if(this.chars[this.charID].side == "jud"){
			this.serv.send(`RT#${testimony}#%`);
		}
	}

	/**
	 * Requests to change the music to the specified track.
	 * @param {string} track the track ID
	 */
	sendMusicChange(track) {
		this.serv.send(`MC#${track}#${this.charID}#%`);
	}

	/**
	 * Requests to leave the room and free the character slot.
	 * 
	 * Note: This packet is undocumented. It is not implemented by
	 * either the AO2 client or tsuserver.
	 */
	sendLeaveRoom() {
		this.serv.send("FC#%");
	}

	/**
	 * Begins the handshake process by sending an identifier
	 * to the server.
	 */
	joinServer() {
		this.serv.send(`HI#${navigator.userAgent.hashCode()}#%`);
		this.serv.send("ID#webAO#2.4.5#%");
		this.checkUpdater = setInterval(() => this.sendCheck(), 5000);
	}
	
	/**
	 * Load game resources.
	 */
	loadResources() {
		// Set to playerID to server chat name
		document.getElementById("OOC_name").value = "web" + this.playerID;
		// Load evidence array to select
		var evidence_select = document.getElementById("evi_select");
		evidence_select.add(new Option("Custom", 0));
		for(let i = 1; i <= evidence_arr.length; i++) {
		  evidence_select.add(new Option(evidence_arr[i - 1]));
		}		
		// Load background array to select
		var background_select = document.getElementById("bg_select");
		background_select.add(new Option("Custom", 0));
		for(let i = 1; i <= background_arr.length; i++) {
		  background_select.add(new Option(background_arr[i - 1]));
		}
		// Calculate gif duration of shouts
		let shouts = ["holdit", "objection", "takethat"];
		for (let i = 0; i < shouts.length; i++) {
			let shout_src = AO_HOST + this.resources[shouts[i]]["src"];
			FileExist(shout_src, this.callbackLoadImageResources, shouts[i]);		
		}
		
		// Calculate gif duration of testimony
		let testimony = ["witnesstestimony", "crossexamination"];
		for (let i = 0; i < testimony.length; i++) {
			let testimony_src = AO_HOST + "themes/default/"+ testimony[i] +".gif";
			// Check iamge existed
			FileExist(testimony_src, this.callbackLoadImageResources, testimony[i]);
			// Check sfx existed
			FileExist(AO_HOST + this.resources[testimony[i]]["sfx"], this.callbackLoadSFXResources, testimony[i]);
		}	
		// TODO: Cache some resources
		
	}
	
	/**
	 * Callback for image resources.
	 * @param {boolean} result the image is existed or not
	 * @param {string} resource the resource name
	 * @param {string} src the url of resource
	 */
	callbackLoadImageResources(result, resource, src) {
		if(result){
			client.resources[resource]["src"] = src;
			viewport.getAnimLength(src,client.callbackGetResourceLength, resource);
		}	
	}
	
	/**
	 * Callback for animation duration resource
	 * @param {integer} length the animation length
	 * @param {string} resource the resource name
	 */
	callbackGetResourceLength(length, resource) {
		client.resources[resource]["duration"] = length; 
	}
	
	/**
	 * Callback for sfx resources.
	 * @param {boolean} result the audio is existed or not
	 * @param {string} resource the resource name
	 * @param {string} src the url of resource
	 */
	callbackLoadSFXResources(result, resource, src) {
		if(result){
			client.resources[resource]["sfx"] = src;
		}	
	}	
	
	/**
	 * Create observer to detect BBCode elements
	 * then manipulate them.
	 */
	initialObservBBCode() {
		var target = document.getElementById("client_inner_chat");
		var observer = new MutationObserver(function(mutations) {
		  mutations.forEach(function(mutation) {
			var children = mutation.addedNodes;
			if (children !== null) {
				children.forEach( function(node) {
					if (node.tagName == "C") {
						node.style.color = node.getAttribute("a");
					} else if(node.tagName == "M"){
						if (node.hasAttribute('a')) {
							node.style.backgroundColor = node.getAttribute("a");
						} else {
							node.style.backgroundColor = "yellow";
							node.style.color = "black";
						}
					}
				});
			}
		  });    
		});
		var config = {attributes: true,childList: true};
		observer.observe(target,config);
	}

	/**
	 * Requests to play as a specified character.
	 * @param {number} character the character ID
	 */
	sendCharacter(character) {
		this.serv.send(`CC#${this.playerID}#${character}#web#%`);
	}

	/**
	 * Requests to select a music track.
	 * @param {number?} song the song to be played
	 */
	sendMusic(song) {
		this.serv.send(`MC#${song}`);
	}

	/**
	 * Sends a keepalive packet.
	 */
	sendCheck() {
		this.serv.send(`CH#${this.charID}#%`);
	}

	/**
	 * Triggered when a connection is established to the server.
	 */
	onOpen(e) {
		// XXX: Why does watching mean just SITTING there and doing nothing?
		if (mode === "watch") {
			document.getElementById("client_loading").style.display = "none";
			document.getElementById("client_charselect").style.display = "none";
		} else {
			client.joinServer();
		}
	}

	/**
	 * Triggered when the connection to the server closes.
	 * @param {CloseEvent} e
	 */
	onClose(e) {
		console.error(`The connection was closed: ${e.reason} (${e.code})`);
		if (e.code !== 1001) {
			document.getElementById("client_error").style.display = "block";
			document.getElementById("error_id").textContent = e.code;
			this.cleanup();
		}
	}

	/**
	 * Triggered when a packet is received from the server.
	 * @param {MessageEvent} e
	 */
	onMessage(e) {
		let msg = e.data;
		console.debug(msg);
		let lines = msg.split('%');
		let args = lines[0].split('#');
		let header = args[0];
		let handler = this.handlers[header];
		if (typeof handler !== "undefined") {
			handler(args);
		} else {
			console.warn(`Invalid packet header ${header}`);
		}
	}

	/**
	 * Triggered when an network error occurs.
	 * @param {ErrorEvent} e 
	 */
	onError(e) {
		console.error(`A network error occurred: ${e.reason} (${e.code})`);
		document.getElementById("client_error").style.display = "block";
		document.getElementById("error_id").textContent = e.code;
		this.cleanup();
	}

	cleanup() {
		try {
			this.serv.close(1001);
		} catch (e) {
			// I don't care if this errors
		}
		clearInterval(this.checkUpdater);
	}

	/**
	 * Handles an in-character chat message.
	 * @param {*} args packet arguments
	 */
	handleMS(args) {
		// TODO: this if-statement might be a bug.
		if (args[4] != viewport.chatmsg.content) {
			document.getElementById("client_inner_chat").innerHTML = "";
			let chatmsg = {
				// pre: escape(args[2]),
				character: -1, // Will do a linear search
				preanim: escape(args[2]), // XXX: why again?
				nameplate: args[3], // TODO: parse INI to get this info
				name: args[3],
				speaking: "(b)" + escape(args[4]),
				silent: "(a)" + escape(args[4]),
				content: decodeBBCode(escapeHtml(decodeChat(unescapeChat(args[5])))), // Escape HTML tag, Use BBCode Only!
				side: args[6],
				sound: escape(args[7]),
				type: args[8],
				// charid: args[9],
				snddelay: args[10],
				objection: args[11],
				evidence: args[12],
				flip: args[13],
				flash: args[14],
				color: args[15],
				isnew: true,
			};

			// The dreaded linear search...
			for (let i = 0; i < this.chars.length; i++) {
				if (this.chars[i].name == args[3]) {
					chatmsg.character = i;
					break;
				}
			}

			if (chatmsg.character == this.charID) {
				resetICParams();
			}

			viewport.say(chatmsg);
		}
	}

	/**
	 * Handles an out-of-character chat message.
	 * @param {Array} args packet arguments
	 */
	handleCT(args) {
		const oocLog = document.getElementById("client_ooclog");
		oocLog.innerHTML += `${decodeChat(unescapeChat(args[1]))}: ${decodeChat(unescapeChat(args[2]))}\r\n`;
		if (oocLog.scrollTop > oocLog.scrollHeight - 60) {
			oocLog.scrollTop = oocLog.scrollHeight;
		}
	}

	/**
	 * Handles a music change to an arbitrary resource.
	 * @param {Array} args packet arguments
	 */
	handleMC(args) {
		const music = viewport.music;
		music.pause();
		music.src = MUSIC_HOST + args[1];
		music.play();
		if (args[2] >= 0) {
			let musicname = this.chars[args[2]].name;
			appendICLog(`${musicname} changed music to ${args[1]}`);
		} else {
			appendICLog(`The music was changed to ${args[1]}`);
		}
	}

	/**
	 * Handles a music change to an arbitrary resource, with an offset in seconds.
	 * @param {Array} args packet arguments
	 */
	handleRMC(args) {
		viewport.music.pause();
		viewport.music = new Audio(this.musicList[args[1]]);
		const music = viewport.music;
		// Music offset + drift from song loading
		music.totime = args[1];
		music.offset = new Date().getTime() / 1000;
		music.addEventListener('loadedmetadata', function() {
			music.currentTime += parseFloat(music.totime + (new Date().getTime() / 1000 - music.offset)).toFixed(3);
			music.play();
		}, false);
	}

	/**
	 * Handles incoming character information, bundling multiple characters
	 * per packet.
	 * @param {Array} args packet arguments
	 */
	handleCI(args) {
		document.getElementById("client_loadingtext").innerHTML = "Loading Character " + args[1];
		this.serv.send("AN#" + ((args[1] / 10) + 1) + "#%");
		for (let i = 2; i < args.length - 1; i++) {
			if (i % 2 == 0) {
				let chargs = args[i].split("&");
				this.chars[args[i - 1]] = {
					"name": chargs[0],
					"desc": chargs[1],
					"evidence": chargs[3],
					"icon": AO_HOST + "characters/" + escape(chargs[0]) + "/char_icon.png"
				};
			}
		}
	}

	/**
	 * Handles incoming character information, containing only one character
	 * per packet.
	 * @param {Array} args packet arguments
	 */
	handleSC(args) {
		document.getElementById("client_loadingtext").innerHTML = "Loading Characters";
		for (let i = 1; i < args.length - 1; i++) {
			let chargs = args[i].split("&");
			this.chars[i - 1] = {
				"name": chargs[0],
				"desc": chargs[1],
				"evidence": chargs[3],
				"icon": AO_HOST + "characters/" + escape(chargs[0]) + "/char_icon.png"
			}
		}
		this.serv.send("RM#%");
	}

	/**
	 * Handles incoming evidence information, containing only one evidence
	 * item per packet.
	 * 
	 * Mostly unimplemented in webAO.
	 * @param {Array} args packet arguments
	 */
	handleEI(args) {
		document.getElementById("client_loadingtext").innerHTML = "Loading Evidence " + args[1];
		//serv.send("AE#" + (args[1] + 1) + "#%");
		this.serv.send("RM#%");
	}
	
	/**
	 * Handles incoming evidence list, all evidences at once
	 * item per packet.
	 * 
	 * @param {Array} args packet arguments
	 */
	handleLE(args) {
		this.evidences = [];
		for (let i = 1; i < args.length - 1; i++) {
			var arg = args[i].split("&");
			this.evidences[i - 1] = {
				"name": escapeHtml(decodeChat(unescapeChat(arg[0]))),
				"desc": escapeHtml(decodeChat(unescapeChat(arg[1]))),
				"filename": escape(arg[2]),
				"icon": AO_HOST + "evidence/" + escape(arg[2])
			}
		}
		
		var evidence_box = document.getElementById("evidences");
		evidence_box.innerHTML = "";
		for(let i = 1; i <= this.evidences.length; i++){
			evidence_box.innerHTML += '<img src="' + this.evidences[i - 1].icon + 
				'" id="evi_' + i +'" alt="' + this.evidences[i - 1].name +
				'" class="client_button" ' +
				'onclick="pickevidence('+ i +')">';								
		}
	}

	/**
	 * Handles incoming music information, containing multiple entries
	 * per packet.
	 * @param {Array} args packet arguments
	 */
	handleEM(args) {
		document.getElementById("client_loadingtext").innerHTML = "Loading Music " + args[1];
		this.serv.send("AM#" + ((args[1] / 10) + 1) + "#%");
		let hmusiclist = document.getElementById("client_musiclist");
		for (let i = 2; i < args.length - 1; i++) {
			if (i % 2 == 0) {
				let newentry = document.createElement("OPTION");
				newentry.text = args[i];
				hmusiclist.options.add(newentry);
			}
		}
	}

	/**
	 * Handles incoming music information, containing only one entry
	 * per packet.
	 * @param {Array} args packet arguments
	 */
	handleSM(args) {
		document.getElementById("client_loadingtext").innerHTML = "Loading Music ";
		let hmusiclist = document.getElementById("client_musiclist"), flagAudio = false;
		
		for (let i = 1; i < args.length - 1; i++) {
			// Check when found the song for the first time
			if(/\.(?:wav|mp3|mp4|ogg|mid)$/i.test(args[i]) && !flagAudio){
				flagAudio = true;
			}
			
			if(flagAudio) {
				// After reached the audio put everything in the music list
				let newentry = document.createElement("OPTION");
				newentry.text = args[i];
				hmusiclist.options.add(newentry);
			
			} else {
				// Create area button
				let newarea = document.createElement("SPAN");
				newarea.className = "location-box";
				newarea.textContent = args[i]; 
				newarea.onclick = function(){ area_click(this) };
				document.getElementById("areas").appendChild(newarea);
			}
		}
		
		// Move first audio title from area box to music list
		let area_box = document.getElementById("areas");
		let audio_title = document.createElement("OPTION");
		audio_title.text = area_box.lastChild.textContent;
		hmusiclist.insertBefore(audio_title, hmusiclist.firstChild);
		area_box.removeChild(area_box.lastChild); // Remove from arae box
				
		this.serv.send("RD#%");		
	}

	/**
	 * Handles incoming music information, containing all entries
	 * in the same packet.
	 * @param {Array} args packet arguments
	 */
	handlemusic(args) {
		for (let i = 0; i < args.length / 2; i++) {
			this.musicList[args[2 * i]] = args[2 * i + 1];
		}
	}

	/**
	 * Handles the handshake completion packet, meaning the player
	 * is ready to select a character.
	 * 
	 * @param {Array} args packet arguments
	 */
	handleDONE(args) {
		document.getElementById("client_loading").style.display = "none";
		document.getElementById("client_charselect").style.display = "block";
	}

	/**
	 * Handles a background change.
	 * @param {Array} args packet arguments
	 */
	handleBN(args) {
		viewport.bgname = escape(args[1]);
		let bg_index = getIndexFromSelect("bg_select", escape(args[1]));
		document.getElementById("bg_select").selectedIndex = bg_index;
		updateBackgroundPreview();
		if(bg_index == 0){
			document.getElementById("bg_filename").value = args[1];
		}
		document.getElementById("bg_preview").src = AO_HOST + 'background/' + escape(args[1]) + "/defenseempty.png";
		if(this.charID == -1){
			changeBackground("jud");
		} else {
			changeBackground(this.chars[this.charID].side);
		}
		
	}

	handleNBG(args) {
		// TODO (set by sD)
	}

	/**
	 * Handles a change in the health bars' states.
	 * @param {Array} args packet arguments
	 */
	handleHP(args) {
		let percent_hp = args[2] * 10;
		if (args[1] == 1) {
			// Def hp
			this.hp[0] = args[2];
			$("#client_defense_hp > .health-bar").animate({ 'width': percent_hp + "%" }, 500);
		} else {
			// Pro hp
			this.hp[1] = args[2];
			$("#client_prosecutor_hp > .health-bar").animate({ 'width': percent_hp + "%" }, 500);
		}		
	}
	
	/**
	 * Handles a testimony states.
	 * @param {Array} args packet arguments
	 */
	handleRT(args) {
		if (args[1] == "testimony1") {
			//Witness Testimony
			this.testimonyID = 1;
		} else {
			//Cross Examination
			this.testimonyID = 2;
		}
		viewport.initTestimonyUpdater();
	}
	
	/**
	 * Handles a call mod message.
	 * @param {Array} args packet arguments
	 */
	handleZZ(args) {
		const oocLog = document.getElementById("client_ooclog");
		oocLog.innerHTML += `\$Alert: ${decodeChat(unescapeChat(args[1]))}\r\n`;
		if (oocLog.scrollTop > oocLog.scrollHeight - 60) {
			oocLog.scrollTop = oocLog.scrollHeight;
		}
	}
	
	/**
	 * Handles the issuance of a player ID by the server.
	 * @param {Array} args packet arguments
	 */
	handleID(args) {
		this.playerID = args[1];
	}

	handlePN(args) {
		this.serv.send("askchaa#%");
	}

	/**
	 * Received when the server announces its server info,
	 * but we use it as a cue to begin retrieving characters.
	 * @param {Array} args packet arguments
	 */
	handleSI(args) {
		if (oldLoading) {
			this.serv.send("askchar2#%");
		} else {
			this.serv.send("RC#%");
		}
	}

	/**
	 * Handles the list of all used and vacant characters.
	 * @param {Array} args packet arguments
	 */
	handleCharsCheck(args) {
		document.getElementById("client_chartable").innerHTML = "";
		for (let i = 0; i < this.chars.length; i++) {
			if (i % CHAR_SELECT_WIDTH == 0) {
				var tr = document.createElement('TR');
			}
			let td = document.createElement('TD');
			let icon_chosen;
			let thispick = this.chars[i].icon;
			if (args[i + 1] == "-1") {
				icon_chosen = " dark";
			} else {
				icon_chosen = "";
			}
			td.innerHTML = `<img class='demothing${icon_chosen}' id='demo_${i}' ` +
				`src='${thispick}' alt='${this.chars[i].name}' onclick='pickchar(${i})' ` +
				`onerror='demoError(this);'>`;
			tr.appendChild(td);
			if (i % CHAR_SELECT_WIDTH == 0) {
				document.getElementById("client_chartable").appendChild(tr);
			}
		}		
		//changeBackground("def");
	}

	/**
	 * Handles the server's assignment of a character for the player to use.
	 * @param {Array} args packet arguments
	 */
	handlePV(args) {
		this.charID = args[3];
		document.getElementById("client_charselect").style.display = "none";
		let me = this.me();
		let emotes = this.emotes;
		let xhr = new XMLHttpRequest();
		let isOfficialAssets = (AO_HOST == "http://assets.aceattorneyonline.com/base/");
		xhr.withCredentials = false;
		document.getElementById("client_emo").innerHTML = ""; // Clear emote box
		xhr.open('GET', AO_HOST + 'characters/' + escape(this.me().name) + '/char.ini', true);
		xhr.responseType = 'text';
		xhr.onload = function (e) {
			if (this.status == 200) {
				let linifile = this.responseText;
				let pinifile = INI.parse(linifile);
				me.side = pinifile.Options.side;
				updateActionCommands(me.side);
				for (let i = 1; i < pinifile.Emotions.number; i++) {
					let emoteinfo = pinifile.Emotions[i].split('#');
					let esfx = "0";
					let esfxd = "0";
					if (typeof pinifile.SoundN !== 'undefined') {
						esfx = pinifile.SoundN[i];
					}
					if (typeof pinifile.SoundT !== 'undefined') {
						esfxd = pinifile.SoundT[i];
					}
					emotes[i] = {
						desc: (isOfficialAssets)? emoteinfo[0].toLowerCase() : emoteinfo[0],
						speaking: (isOfficialAssets)? emoteinfo[1].toLowerCase() : emoteinfo[1],
						silent: (isOfficialAssets)? emoteinfo[2].toLowerCase() : emoteinfo[2],
						zoom: emoteinfo[3],
						sfx: (isOfficialAssets)? esfx.toLowerCase() : esfx,
						sfxdelay: esfxd,
						button_off: AO_HOST + 'characters/' + ((isOfficialAssets)? escape(me.name).toLowerCase() : escape(me.name)) + '/emotions/button' + i + '_off.png',
						button_on: AO_HOST + 'characters/' + ((isOfficialAssets)? escape(me.name).toLowerCase() : escape(me.name)) + '/emotions/button' + i + '_on.png'
					};
					document.getElementById("client_emo").innerHTML += "<img src='" + emotes[i].button_off + "' id='emo_" + i + "' alt='" + emotes[i].desc + "' class='client_button' onclick='pickemotion(" + i + ")'>";
				}
				pickemotion(1);
			}
		};
		xhr.send();
	}		
}

class Viewport {
	constructor() {
		this.textnow = "";
		this.chatmsg = {
			"isnew": false,
			"content": "",
			"objection": "0",
			"sound": "",
			"startpreanim": false,
			"startspeaking": false,
			"side": null,
			"color": "0",
			"snddelay": 0,
			"preanimdelay": 0
		};
		this.blip = new Audio(AO_HOST + 'sounds/general/sfx-blipmale.wav');
		this.blip.volume = 0.5;

		// Allocate multiple blip audio channels to make blips less jittery

		// TODO: read blip type ("gender") from ini
		this.blipChannels = new Array(6);
		for (let i = 0; i < this.blipChannels.length; i++) {
			this.blipChannels[i] = new Audio(AO_HOST + 'sounds/general/sfx-blipmale.wav');
			this.blipChannels[i].volume = 0.5;
		}
		this.currentBlipChannel = 0;

		this.sfxaudio = new Audio(AO_HOST + 'sounds/general/sfx-blipmale.wav');
		this.sfxplayed = 0;

		this.music = new Audio();
		this.music.play();

		this.updater = null;
		this.testimonyUpdater = null;

		this.bgname = "gs4";
		
		this.testimonyTimer = 0;
		this.shoutTimer = 0;
		this.textTimer = 0;

		this._animating = false;
	}

	/**
	 * Returns whether or not the viewport is busy
	 * performing a task (animating).
	 */
	isAnimating() {
		return this._animating;
	}

	/**
	 * Sets the volume of the blip sound.
	 * @param {number} volume
	 */
	setBlipVolume(volume) {
		for (let i = 0; i < this.blipChannels.length; i++) {
			this.blipChannels[i].volume = volume;
		}
	}

	/**
	 * Returns the path which the background is located in.
	 */
	bgFolder() {
		return `${AO_HOST}background/${this.bgname}/`;
	}

	/**
	 * Sets a new emote.
	 * @param {object} chatmsg the new chat message
	 */
	say(chatmsg) {
		this.chatmsg = chatmsg;
		appendICLog(chatmsg.content, chatmsg.nameplate);
		changeBackground(chatmsg.side);
		this.textnow = '';
		this.sfxplayed = 0;
		this.textTimer = 0;
		this._animating = true;
		clearTimeout(this.updater);
		//If preanim existed then determine the length
		if (chatmsg.preanim != "-") {
			chatmsg.preanimdelay = this.getAnimLength(AO_HOST + 'characters/' + escape(chatmsg.name) + '/' + chatmsg.preanim + '.gif',this.initUpdater);
		} else {
			this.initUpdater(0)
		}
	}
	
	/**
	 * Intialize updater
	 * @param {int} animdelay the length of pre-animation 
	 */
	initUpdater(animdelay){
		viewport.chatmsg.preanimdelay = parseInt(animdelay); 
		viewport.updater = setTimeout(() => viewport.updateText(), UPDATE_INTERVAL);
	}
	
	/**
	 * Intialize testimony updater 
	 */
	initTestimonyUpdater(){		
		if(client.testimonyID > 0){			
			let testimony = "";
			if (client.testimonyID == 1) {
				testimony = "witnesstestimony";				
			} else if (client.testimonyID == 2) {
				testimony = "crossexamination";
			}
			(new Audio(client.resources[testimony]["sfx"])).play();
			this.testimonyTimer = 0;
			document.getElementById("client_testimony").src = client.resources[testimony]["src"];
			this.testimonyUpdater = setTimeout(() => this.updateTestimony(), UPDATE_INTERVAL);						
		}
	}
	
	/**
	 * Gets animation length.
	 * @param {string} filename the animation file name
	 * @param {function} callback the callback function
	 * @param {object} param 
	 */
	getAnimLength(filename, callback, param) {
		var request = new XMLHttpRequest();
		request.open('GET', filename, true);
		request.responseType = 'arraybuffer';
		request.addEventListener('load', function () {
			// Use gify API
			// https://github.com/rfrench/gify
			var gifInfo = gify.getInfo(request.response);
			console.log(gifInfo["duration"]);
			// Return animation length
			callback(gifInfo["duration"], param);
		});
		request.send();
	}
	
	/**
	 * Updates the testimony overaly
	 */
	updateTestimony(){
		//Update timer
		this.testimonyTimer = this.testimonyTimer + UPDATE_INTERVAL;
		
		if (client.testimonyID == 1) {
			//Witness Testimony
			if (this.testimonyTimer >= client.resources["witnesstestimony"]["duration"]){
				//Finish
				this.disposeTestimony();
			} else {
				this.testimonyUpdater = setTimeout(() => this.updateTestimony(), UPDATE_INTERVAL);
			}			
		} else if (client.testimonyID == 2) {
			//Cross Examination
			if (this.testimonyTimer >= client.resources["crossexamination"]["duration"]){
				//Finish
				this.disposeTestimony();
			} else {
				this.testimonyUpdater = setTimeout(() => this.updateTestimony(), UPDATE_INTERVAL);
			}
		} else {
			this.disposeTestimony();
		}
	}
	
	/**
	 * Dispose the testimony overlay
	 */
	 disposeTestimony(){
		client.testimonyID = 0;
		this.testimonyTimer = 0;
		document.getElementById("client_testimony").src = "misc/placeholder.gif";
		clearTimeout(this.testimonyUpdater);
	 }
	 
	/**
	 * Updates the chatbox based on the given text.
	 * 
	 * XXX: This relies on a global variable `this.chatmsg`!
	 */
	updateText() {
		// Flip the character
		if (this.chatmsg.flip == 1){
			document.getElementById("client_char").style.transform = "scaleX(-1)"; 
		} else {
			document.getElementById("client_char").style.transform = "scaleX(1)";
		}
			
		if (this._animating) {
			this.updater = setTimeout(() => this.updateText(), UPDATE_INTERVAL);
		}

		if (this.chatmsg.isnew) {
			// Reset screen background
			document.getElementById("client_background").style.backgroundColor = "transparent";
			//Hide message and evidence window
			document.getElementById("client_name").style.display = "none";
			document.getElementById("client_chat").style.display = "none";
			document.getElementById("client_evi").style.opacity = "0";
			document.getElementById("client_evi").style.height = "0%";
			const shouts = {
				"1": "holdit",
				"2": "objection",
				"3": "takethat"
			};

			let shout = shouts[this.chatmsg.objection];
			if (typeof shout !== "undefined") {
				document.getElementById("client_shout").src = client.resources[shout]["src"];
				(new Audio(`${AO_HOST}/characters/${this.chatmsg.name}/${shout}.wav`)).play();
				this.shoutTimer = 850;
			} else {
				this.shoutTimer = 0;
			}

			this.chatmsg.isnew = false;
			this.chatmsg.startpreanim = true;
		}

		if(this.textTimer >= this.shoutTimer && this.chatmsg.startpreanim) {
			// Effect stuff
			if (this.chatmsg.flash == 2){
				//Shake screen
				this.sfxaudio.pause();
				this.sfxplayed = 1;
				this.sfxaudio.src = AO_HOST + "sounds/general/sfx-stab.wav";
				this.sfxaudio.play();
				$('#client_gamewindow').effect( "shake",{"direction":"up"});
			} else if (this.chatmsg.flash == 1) {
				//Flash screen
				document.getElementById("client_background").style.backgroundColor = "white";
				this.sfxaudio.pause();
				this.sfxplayed = 1;
				this.sfxaudio.src = AO_HOST + "sounds/general/sfx-realization.wav";
				this.sfxaudio.play();
				$('#client_gamewindow').effect("pulsate");
			}
			
			//Pre-animation stuff
			if(this.chatmsg.preanimdelay > 0){
				document.getElementById("client_shout").src = "misc/placeholder.gif";
				changeBackground(this.chatmsg.side);
				document.getElementById("client_char").src = AO_HOST + "characters/" + escape(this.chatmsg.name) + "/" + this.chatmsg.preanim + ".gif";
			}
			this.chatmsg.startpreanim = false;
			this.chatmsg.startspeaking = true;
		} else if (this.textTimer >= this.shoutTimer + this.chatmsg.preanimdelay && !this.chatmsg.startpreanim) {
			if (this.chatmsg.startspeaking) {
				if(this.chatmsg.evidence > 0){
					// Prepare evidence
					document.getElementById("client_evi").style.backgroundImage = "url('"+ client.evidences[this.chatmsg.evidence - 1].icon +"')";
				
					if (this.chatmsg.side == 'def'){
						// Only def show evidence on right
						document.getElementById("client_evi").style.right = "1.5em";
						document.getElementById("client_evi").style.left = "initial";
						$( "#client_evi" ).animate({
							height: "30%",
							opacity: 1
						}, 250 );
					} else {
						document.getElementById("client_evi").style.right = "initial";
						document.getElementById("client_evi").style.left = "1.5em";
						$( "#client_evi" ).animate({
							height: "30%",
							opacity: 1
						}, 250 );
					}
				}
				
				$("#client_name").toggle( "fade" );
				$("#client_chat").toggle("drop",{"direction":"down"});
				if(this.chatmsg.preanimdelay == 0){
					document.getElementById("client_shout").src = "misc/placeholder.gif";
					changeBackground(this.chatmsg.side);
				}
				document.getElementById("client_char").src = AO_HOST + "characters/" + escape(this.chatmsg.name) + "/" + this.chatmsg.speaking + ".gif";
				document.getElementById("client_name").style.fontSize = (document.getElementById("client_name").offsetHeight * 0.7) + "px";
				document.getElementById("client_chat").style.fontSize = (document.getElementById("client_chat").offsetHeight * 0.25) + "px";
				document.getElementById("client_name").innerHTML = "<p>" + escapeHtml(this.chatmsg.nameplate) + "</p>";

				const colors = {
					"0": "#ffffff",
					"1": "#00ff00",
					"2": "#ff0000",
					"3": "#ffaa00",
					"4": "#0000ff",
					"5": "#ffff00",
					"6": "#aa00aa"
				}
				let stylecolor = "color: " + (colors[this.chatmsg.color] || "#ffffff");
				document.getElementById("client_inner_chat").style = stylecolor;
				this.chatmsg.startspeaking = false;

				if (this.textnow == this.chatmsg.content) {
					document.getElementById("client_char").src = AO_HOST + "characters/" + escape(this.chatmsg.name) + "/" + this.chatmsg.silent + ".gif";
					this._animating = false;
					clearTimeout(this.updater);
				}
			} else {
				if (this.textnow != this.chatmsg.content) {
					if (this.chatmsg.content.charAt(this.textnow.length) != " ") {
						this.blipChannels[this.currentBlipChannel].play();
						this.currentBlipChannel++;
						this.currentBlipChannel %= this.blipChannels.length;
					}
					this.textnow = this.chatmsg.content.substring(0, this.textnow.length + 1);
					document.getElementById("client_inner_chat").innerHTML = this.textnow;
					if (this.textnow == this.chatmsg.content) {
						this.textTimer = 0;
						this._animating = false;
						document.getElementById("client_char").src = AO_HOST + "characters/" + escape(this.chatmsg.name) + "/" + this.chatmsg.silent + ".gif";
						clearTimeout(this.updater);
					}
				}
			}
		}
		
		if (!this.sfxplayed && this.chatmsg.snddelay + this.shoutTimer >= this.textTimer) {
			this.sfxaudio.pause();
			this.sfxplayed = 1;
			if (this.chatmsg.sound != "0" && this.chatmsg.sound != "1") {
				this.sfxaudio.src = AO_HOST + "sounds/general/" + escape(this.chatmsg.sound) + ".wav";
				this.sfxaudio.play();
			}
		}
		this.textTimer = this.textTimer + UPDATE_INTERVAL;
	}
}

class INI {
	static parse(data) {
		let regex = {
			section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
			param: /^\s*([\w\.\-\_]+)\s*=\s*(.*?)\s*$/,
			comment: /^\s*;.*$/
		};
		let value = {};
		let lines = data.split(/\r\n|\r|\n/);
		let section = null;
		lines.forEach(function(line) {
			if (regex.comment.test(line)) {
				return;
			} else if (line.length == 0) {
				return;
			} else if (regex.param.test(line)) {
				let match = line.match(regex.param);
				if (section) {
					value[section][match[1]] = match[2];
				} else {
					value[match[1]] = match[2];
				}
			} else if (regex.section.test(line)) {
				let match = line.match(regex.section);
				value[match[1]] = {};
				section = match[1];
			};
		});
		return value;
	}
}

/**
 * Triggered when the Return key is pressed on the out-of-character chat input box.
 * @param {KeyboardEvent} event
 */
export function onOOCEnter(event) {
	if (event.keyCode == 13) {
		client.sendOOC(document.getElementById("client_oocinputbox").value);
		document.getElementById("client_oocinputbox").value = "";
	}
}
window.onOOCEnter = onOOCEnter;

/**
 * Triggered when the Return key is pressed on the in-character chat input box.
 * @param {KeyboardEvent} event
 */
export function onEnter(event) {
	if (event.keyCode == 13) {
		let mychar = client.me();
		let myemo = client.myEmote();
		let myevi = client.myEvidence();
		let myflip = ((client.flip)? 1:0);
		let mycolor = document.getElementById("textcolor").value;
		let ssfxname = "0";
		let ssfxdelay = "0";
		if (document.getElementById("sendsfx").checked) {
			ssfxname = myemo.sfx;
			ssfxdelay = myemo.sfxdelay;
		}
		client.sendIC(myemo.speaking, mychar.name, myemo.silent, document.getElementById("client_inputbox").value, mychar.side, ssfxname, myemo.zoom, ssfxdelay, selectedShout, myevi, myflip, selectedEffect, mycolor);
	}
}
window.onEnter = onEnter;

/**
 * Resets the IC parameters for the player to enter a new chat message.
 * This should only be called when the player's previous chat message
 * was successfully sent/presented.
 */
function resetICParams() {
	document.getElementById("client_inputbox").value = "";
	if (selectedEffect) {
		document.getElementById("button_effect_" + selectedEffect).className = "client_button";
		selectedEffect = 0;
	}
	if (selectedShout) {
		document.getElementById("button_" + selectedShout).className = "client_button";
		selectedShout = 0;
	}		
}

/**
 * Triggered when an item on the music list is clicked.
 * @param {MouseEvent} event
 */
export function musiclist_click(event) {
	let playtrack = document.getElementById("client_musiclist").value;
	client.sendMusicChange(playtrack);
}
window.musiclist_click = musiclist_click;

/**
 * Triggered when an item on the music list is clicked.
 * @param {MouseEvent} event
 */
export function area_click(el) {
	let playtrack =  el.textContent;
	client.sendMusicChange(playtrack);
}
window.area_click = area_click;

/**
 * Triggered by the music volume slider.
 */
export function changeMusicVolume() {
	viewport.music.volume = document.getElementById("client_mvolume").value / 100;
}
window.changeMusicVolume = changeMusicVolume;

/**
 * Triggered by the sound effect volume slider.
 */
export function changeSFXVolume() {
	viewport.sfxaudio.volume = document.getElementById("client_svolume").value / 100;
}
window.changeSFXVolume = changeSFXVolume;

/**
 * Triggered by the blip volume slider.
 */
export function changeBlipVolume() {
	viewport.setBlipVolume(document.getElementById("client_bvolume").value / 100);
}
window.changeBlipVolume = changeBlipVolume;

/**
 * Triggered when a character icon is clicked in the character selection menu.
 * @param {MouseEvent} event
 */
export function changeCharacter(event) {
	client.sendLeaveRoom();
	document.getElementById("client_charselect").style.display = "block";
	document.getElementById("client_emo").innerHTML = "";
}
window.changeCharacter = changeCharacter;

/**
 * Triggered when there was an error loading a character sprite.
 * @param {HTMLImageElement} image the element containing the missing image
 */
export function imgError(image) {
	image.onerror = "";
	image.src = "misc/placeholder.gif";
	return true;
}
window.imgError = imgError;

/**
 * Triggered when there was an error loading a character icon.
 * @param {HTMLImageElement} image the element containing the missing image
 */
export function demoError(image) {
	image.onerror = "";
	image.src = "/misc/placeholder.png";
	return true;
}
window.demoError = demoError;

/**
 * Checks if an file exists at the specified URI.
 * @param {string} url the URI to be checked
 * @param {function} callback the function to be called when finished
 * @param {object} param 
 */
function FileExist(url,callback,param) {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			callback(true, param, url);
		} else {
			callback(false, param, url);
		}
	};
	xhttp.open("GET", url, true);
	xhttp.send();
}

/**
 * Changes the viewport background based on a given position.
 * 
 * Valid positions: `def, pro, hld, hlp, wit, jud`
 * @param {string} position the position to change into
 */
function changeBackground(position) {
	var standname;
	let bgfolder = viewport.bgFolder();
	document.getElementById("client_fg").style.display = "none";
	document.getElementById("client_bench").style.display = "none";
	switch (position) {
		case "def":
			document.getElementById("client_court").src = bgfolder + "defenseempty.png"
			document.getElementById("client_bench").style.display = "block";
			FileExist(bgfolder + "defensedesk.png", callbackChangeBackground, position);
			standname = "defense";
			break;
		case "pro":
			document.getElementById("client_court").src = bgfolder + "prosecutorempty.png"
			document.getElementById("client_bench").style.display = "block"
			FileExist(bgfolder + "defensedesk.png", callbackChangeBackground, position);
			standname = "prosecution";
			break;
		case "hld":
			document.getElementById("client_court").src = bgfolder + "helperstand.png"
			standname = "defense";
			break;
		case "hlp":
			document.getElementById("client_court").src = bgfolder + "prohelperstand.png"
			standname = "prosecution";
			break;
		case "wit":
			document.getElementById("client_court").src = bgfolder + "witnessempty.png"
			document.getElementById("client_bench").style.display = "block"
			document.getElementById("client_bench").src = bgfolder + "estrado.png"
			standname = "prosecution";
			break;
		case "jud":
			document.getElementById("client_court").src = bgfolder + "judgestand.png"
			standname = "prosecution";
			break;
	}
	if (viewport.chatmsg.type == 5) {
		document.getElementById("client_bench").style.display = "none";
		document.getElementById("client_court").src = AO_HOST + "themes/default/" + standname + "_speedlines.gif";
	}
}

/**
 * Callback for desk resource
 * 
 * Valid positions: `def, pro, hld, hlp, wit, jud`
 * @param {boolean} result the image is existed or not
 * @param {string} position the position to change into
 */
function callbackChangeBackground(result,position) {
	let bgfolder = viewport.bgFolder();
	if (position == "def"){
		if(result){
			document.getElementById("client_bench").src = bgfolder + "defensedesk.png"
		}else{
			document.getElementById("client_bench").src = bgfolder + "bancodefensa.png"
		}
	} else {
		if(result){
			document.getElementById("client_bench").src = bgfolder + "prosecutiondesk.png"
		} else {
			document.getElementById("client_bench").src = bgfolder + "bancoacusacion.png"
		}			
	}
}

/**
 * Triggered when the reconnect button is pushed.
 */
export function ReconnectButton() {
	client.cleanup();
	client = new Client(serverIP);
	if (client) {
		mode = "join"; // HACK: see client.onOpen
		document.getElementById("client_error").style.display = "none";
	}
}
window.ReconnectButton = ReconnectButton;

/**
 * Triggered when the retry button is pushed (during the loading process).
 */
export function RetryButton() {
	client.joinServer();
}
window.RetryButton = RetryButton;

/**
 * Appends a message to the in-character chat log.
 * @param {string} toadd the string to be added
 * @param {string} name the name of the sender
 */
function appendICLog(toadd, name = "", time = new Date()) {
	const entry = document.createElement("p");
	const nameField = document.createElement("span");
	nameField.id = "iclog_name";
	nameField.appendChild(document.createTextNode(name));
	entry.appendChild(nameField);
	entry.appendChild(document.createTextNode(toadd));

	// Only put a timestamp if the minute has changed.
	if (lastICMessageTime.getMinutes() !== time.getMinutes()) {
		const timeStamp = document.createElement("span");
		timeStamp.id = "iclog_time";
		timeStamp.innerText = time.toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit"
		});
		entry.appendChild(timeStamp);
	}

	const clientLog = document.getElementById("client_log");
	clientLog.appendChild(entry);

	if (clientLog.scrollTop > clientLog.scrollHeight - 600) {
		clientLog.scrollTop = clientLog.scrollHeight;
	}

	lastICMessageTime = new Date();
}

/**
 * Requests to play as a character.
 * @param {number} ccharacter the character ID; if this is a large number, then spectator is chosen instead.
 */
export function pickchar(ccharacter) {
	if (ccharacter < 1000) {
		client.sendCharacter(ccharacter);
	} else {
		// Spectator
		document.getElementById("client_charselect").style.display = "none";
		document.getElementById("client_inputbox").style.display = "none";
		document.getElementById("client_emo").style.display = "none";
	}
}
window.pickchar = pickchar;

/**
 * Highlights and selects an emotion for in-character chat.
 * @param {string} emo the new emotion to be selected
 */
export function pickemotion(emo) {
	if (client.selectedEmote != -1) {
		document.getElementById("emo_" + client.selectedEmote).src = client.myEmote().button_off;
	}
	client.selectedEmote = emo
	document.getElementById("emo_" + emo).src = client.myEmote().button_on;
}
window.pickemotion = pickemotion;

/**
 * Highlights and selects an evidence for in-character chat.
 * @param {string} evidence the evidence to be presented
 */
export function pickevidence(evidence) {
	if (client.selectedEvidence != evidence) {
		//Update selected evidence		
		if(client.selectedEvidence > 0){
			document.getElementById("evi_" + client.selectedEvidence).className = "client_button";
		}
		document.getElementById("evi_" + evidence).className = "client_button dark";
		client.selectedEvidence = evidence;
		
		// Show evidence on information window
		document.getElementById("evi_name").value = client.evidences[evidence - 1].name;
		document.getElementById("evi_desc").value = client.evidences[evidence - 1].desc;

		//Update Icon
		let icon_id  = getIndexFromSelect("evi_select", client.evidences[evidence - 1].filename);
		document.getElementById("evi_select").selectedIndex = icon_id;
		if (icon_id == 0){			
			document.getElementById("evi_filename").value = client.evidences[evidence - 1].filename;
		}
		updateEvidenceIcon();
		
		// Update button
		document.getElementById("evi_add").className = "client_button hover_button inactive";
		document.getElementById("evi_edit").className = "client_button hover_button";
		document.getElementById("evi_cancel").className = "client_button hover_button";
		document.getElementById("evi_del").className = "client_button hover_button";
	} else {
		cancelevidence();
	}
}
window.pickevidence = pickevidence;

/**
 * Add evidence.
 */
export function addevidence() {
	let evidence_select = document.getElementById('evi_select');
	client.sendPE( document.getElementById('evi_name').value,
		document.getElementById('evi_desc').value,
		(evidence_select.selectedIndex == 0)? 
			document.getElementById('evi_filename').value : 
			evidence_select.options[evidence_select.selectedIndex].text   
		);
	cancelevidence();
}
window.addevidence = addevidence;

/**
 * Edit selected evidence.
 */
export function editevidence() {
	let evidence_select = document.getElementById('evi_select');
	let id = parseInt(client.selectedEvidence) - 1;
	client.sendEE( id, 
		document.getElementById('evi_name').value,
		document.getElementById('evi_desc').value,
		(evidence_select.selectedIndex == 0)? 
			document.getElementById('evi_filename').value : 
			evidence_select.options[evidence_select.selectedIndex].text   
		);
	cancelevidence();
}
window.editevidence = editevidence;

/**
 * Delete selected evidence.
 */
export function delevidence() {
	let id = parseInt(client.selectedEvidence) - 1;
	client.sendDE(id);
	cancelevidence();
}
window.delevidence = delevidence;

/**
 * Cancel evidence selection.
 */
export function cancelevidence() {
	//Clear evidence data
	if(client.selectedEvidence > 0){
		document.getElementById("evi_" + client.selectedEvidence).className = "client_button";
	}
	client.selectedEvidence = 0;
	
	// Clear evidence on information window
	document.getElementById("evi_select").selectedIndex = 0;
	updateEvidenceIcon(); // Update icon widget
	document.getElementById("evi_filename").value = "";
	document.getElementById("evi_name").value = "";
	document.getElementById("evi_desc").value = "";
	document.getElementById("evi_icon").style.backgroundImage = "url('misc/empty.png')"; //Clear icon
	
	// Update button
	document.getElementById("evi_add").className = "client_button hover_button";
	document.getElementById("evi_edit").className = "client_button hover_button inactive";
	document.getElementById("evi_cancel").className = "client_button hover_button inactive";
	document.getElementById("evi_del").className = "client_button hover_button inactive";
}
window.cancelevidence = cancelevidence;

/**
 * Find index of anything in select box.
 * @param {string} select_box the select element name
 * @param {string} value the value that need to be compared
 */
export function getIndexFromSelect(select_box, value) {
		//Find if icon alraedy existed in select box
		let select_element = document.getElementById(select_box);
		for (let i = 1; i < select_element.length; ++i){
			if (select_element.options[i].value == value){
				return i;
			}
		}
		return 0;
}
window.getIndexFromSelect = getIndexFromSelect;

/**
 * Update evidence icon.
 */
export function updateEvidenceIcon() {
	let evidence_select = document.getElementById("evi_select");
	let evidence_filename = document.getElementById("evi_filename");
	let evidence_iconbox = document.getElementById("evi_icon");
	
	if (evidence_select.selectedIndex == 0) {
		evidence_filename.style.display = "initial";
		evidence_iconbox.style.backgroundImage = "url('" + AO_HOST + 'evidence/' + evidence_filename.value + "')";
	} else {		
		evidence_filename.style.display = "none";
		evidence_iconbox.style.backgroundImage = "url('" + AO_HOST + 'evidence/' + evidence_select.value + "')" ;
	}
}
window.updateEvidenceIcon = updateEvidenceIcon;

/**
 * Update evidence icon.
 */
export function updateActionCommands(side) {
	if(side == "jud"){
		document.getElementById("judge_action").style.display = "inline-table";
		document.getElementById("no_action").style.display = "none";
	} else {
		document.getElementById("no_action").style.display = "inline-table";
		document.getElementById("judge_action").style.display = "none";
	}
	//Update role selector
	for(let i = 0, role_select = document.getElementById("role_select").options; i < role_select.length; i++){
			if(side == role_select[i].value){
				role_select.selectedIndex = i;
				return;
			}
	}
}
window.updateActionCommands = updateActionCommands;

/**
 * Change background via OOC.
 */
export function changeBackgroundOOC() {
	let filename = "", background_select = document.getElementById("bg_select")
		, bg_command = document.getElementById("bg_command").value;
	if (background_select.selectedIndex == 0) {
		filename = document.getElementById("bg_filename").value; 
	} else{
		filename = background_select.value;
	}
	client.sendOOC("/" + bg_command.replace("$1",filename));
}
window.changeBackgroundOOC = changeBackgroundOOC;

/**
 * Change role via OOC.
 */
export function changeRoleOOC() {
	let role_select = document.getElementById("role_select")
		, role_command = document.getElementById("role_command").value;
		
	client.sendOOC("/" + role_command.replace("$1",role_select.value));
	updateActionCommands(role_select.value);
}
window.changeRoleOOC = changeRoleOOC;

/**
 * Random character via OOC.
 */
export function randomCharacterOOC() {		
	client.sendOOC("/" + document.getElementById("randomchar_command").value);
}
window.randomCharacterOOC = randomCharacterOOC;

/**
 * Call mod.
 */
export function callmod() {	
	$( "#callmod_dialog" ).dialog( "open" );	
}
window.callmod = callmod;

/**
 * Decalre witness testimony.
 */
export function initwt() {		
	client.sendRT("testimony1");
}
window.initwt = initwt;

/**
 * Decalre cross examination.
 */
export function initce() {		
	client.sendRT("testimony2");
}
window.initce = initce;

/**
 * Add defense health point.
 */
export function addHPD() {		
	client.sendHP(1,String(parseInt(client.hp[0]) + 1));
}
window.addHPD = addHPD;

/**
 * Reduce defense health point.
 */
export function redHPD() {		
	client.sendHP(1,String(parseInt(client.hp[0]) - 1));
}
window.redHPD = redHPD;

/**
 * Add prosecution health point.
 */
export function addHPP() {		
	client.sendHP(2,String(parseInt(client.hp[1]) + 1));
}
window.addHPP = addHPP;

/**
 * Reduce prosecution health point.
 */
export function redHPP() {		
	client.sendHP(2,String(parseInt(client.hp[1]) - 1));
}
window.redHPP = redHPP;

/**
 * Update background preview.
 */
export function updateBackgroundPreview() {
	let background_select = document.getElementById("bg_select");
	let background_filename = document.getElementById("bg_filename");
	let background_preview = document.getElementById("bg_preview");
	
	if (background_select.selectedIndex == 0) {
		background_filename.style.display = "initial";
		background_preview.src = AO_HOST + 'background/' + background_filename.value + "/defenseempty.png";
	} else {
		background_filename.style.display = "none";
		background_preview.src = AO_HOST + 'background/' + background_select.value + "/defenseempty.png";
	}
}
window.updateBackgroundPreview = updateBackgroundPreview;

/**
 * Highlights and selects an effect for in-character chat.
 * If the same effect button is selected, then the effect is canceled.
 * @param {string} effect the new effect to be selected
 */
export function toggleaffect(effect) {
	if (effect == selectedEffect) {
		document.getElementById("button_effect_" + effect).className = "client_button";
		selectedEffect = 0;
	} else {
		document.getElementById("button_effect_" + effect).className = "client_button dark";
		if (selectedEffect) {
			document.getElementById("button_effect_" + selectedEffect).className = "client_button";
		}
		selectedEffect = effect;
	}
}
window.toggleaffect = toggleaffect;

/**
 * Toggle flip for in-character chat.
 */
export function toggleflip() {
	if (client.flip) {
		document.getElementById("button_flip").className = "client_button";
	} else {
		document.getElementById("button_flip").className = "client_button dark";
	}
	client.flip = !client.flip;
}
window.toggleflip = toggleflip;

/**
 * Toggle presentable for presenting evidence in-character chat.
 */
export function togglepresent() {
	if (client.presentable) {
		document.getElementById("button_present").className = "client_button";
	} else {
		document.getElementById("button_present").className = "client_button dark";
	}
	client.presentable = !client.presentable;
}
window.togglepresent = togglepresent;

/**
 * Highlights and selects a menu.
 * @param {string} menu the menu to be selected
 */
export function togglemenu(menu) {
	if (menu != selectedMenu) {
		document.getElementById("menu_" + menu).className = "menu_icon active";
		document.getElementById("content_" + menu).className = "menu_content active";
		document.getElementById("menu_" + selectedMenu).className = "menu_icon";
		document.getElementById("content_" + selectedMenu).className = "menu_content";
		selectedMenu = menu;
	}
}
window.togglemenu = togglemenu;

/**
 * Highlights and selects a shout for in-character chat.
 * If the same shout button is selected, then the shout is canceled.
 * @param {string} shout the new shout to be selected
 */
export function toggleshout(shout) {
	if (shout == selectedShout) {
		document.getElementById("button_" + shout).className = "client_button";
		selectedShout = 0;
	} else {
		document.getElementById("button_" + shout).className = "client_button dark";
		if (selectedShout) {
			document.getElementById("button_" + selectedShout).className = "client_button";
		}
		selectedShout = shout;
	}
}
window.toggleshout = toggleshout;

/**
 * Escapes a string to be HTML-safe.
 * 
 * XXX: This is unnecessary if we use `createTextNode` instead!
 * @param {string} unsafe an unsanitized string
 */
function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Escapes a string to AO1 escape codes.
 * @param {string} estring the string to be escaped
 */
function escapeChat(estring) {
	return estring
		.replace(/#/g, "<pound>")
		.replace(/&/g, "<and>")
		.replace(/%/g, "<percent>")
		.replace(/\$/g, "<dollar>");
}

/**
 * Unescapes a string to AO1 escape codes.
 * @param {string} estring the string to be unescaped
 */
function unescapeChat(estring) {
	return estring
		.replace(/<pound>/g, "#")
		.replace(/<and>/g, "&")
		.replace(/<percent>/g, "%")
		.replace(/<dollar>/g, "$");
}

/**
 * Encoding text on client side.
 * @param {string} estring the string to be encoded
 */
function encodeChat(estring) {
	let selectedEncoding = document.getElementById("client_encoding").value;
	if (selectedEncoding == "unicode") {
		//Source: https://gist.github.com/mathiasbynens/1243213
		return estring.replace(/[^\0-~]/g, function(ch) {
			return "\\u" + ("000" + ch.charCodeAt().toString(16)).slice(-4); });
	} else if (selectedEncoding == "utf16"){
		//Source: https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
		var buffer = new ArrayBuffer(estring.length*2);
		var result = new Uint16Array(buffer);
		for (var i=0, strLen=estring.length; i < strLen; i++) {
			result[i] = estring.charCodeAt(i);
		}
		return String(result);
	} else {
		return estring;
	}
}

/**
 * Decoding text on client side.
 * @param {string} estring the string to be decoded
 */
function decodeChat(estring) {
	let selectedDecoding = document.getElementById("client_decoding").value;
	if (selectedDecoding == "unicode") {
		//Source: https://stackoverflow.com/questions/7885096/how-do-i-decode-a-string-with-escaped-unicode
        return estring.replace(/\\u([\d\w]{1,})/gi, function (match, group) {
			return String.fromCharCode(parseInt(group, 16)); } );
	} else if (selectedDecoding == "utf16"){	
		//Source: https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
		return String.fromCharCode.apply(null, new Uint16Array(estring.split(",")));
	} else {
		return estring;
	}
}

/**
 * Decoding text on client side.
 * @param {string} estring the string to be decoded
 */
function decodeBBCode(estring) {
	return estring
		.replace(/\\n/g, "<br>") // Newline \n
		.replace(/\[(\/?)b\]/g, "<$1b>") // Bold [b][/b]
		.replace(/\[(\/?)i\]/g, "<$1i>") // Italic [i][/i]
		.replace(/\[(\/?)s\]/g, "<$1del>") // Strikethrough  [s][/s]
		.replace(/\[(\/?)u\]/g, "<$1u>") // Underline [u][/u]
		.replace(/\[(\/?)sub\]/g, "<$1sub>") // Subscript [sub][/sub]
		.replace(/\[(\/?)sup\]/g, "<$1sup>") // Superscript [sup][/sup]
		.replace(/\[m=([#a-zA-Z0-9]+)\]/g, '<m a="$1">') // Markup [m=#0ff]
		.replace(/\[(\/?)m\]/g, '<$1m>') // [m][/m]
		.replace(/\[c=?([#a-zA-Z0-9]+)\]/g, '<c a="$1">') // Color [c=red]
		.replace(/\[\/c\]/g, '</c>'); // [/c]
}


// TODO: Possibly safe to remove, since we are using a transpiler.
if (typeof(String.prototype.trim) === "undefined")
{
    String.prototype.trim = function() 
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

// Used for HDID calculation.
String.prototype.hashCode = function() {
	var hash = 0, i, chr;
	if (this.length === 0) return hash;
	for (i = 0; i < this.length; i++) {
	  chr   = this.charCodeAt(i);
	  hash  = ((hash << 5) - hash) + chr;
	  hash |= 0; // Convert to 32bit integer
	}
	return hash;
};


//
// Client code
//

let client = new Client(serverIP);
let viewport = new Viewport();

$(document).ready(function(){
	client.initialObservBBCode();
	client.loadResources(); 
	
});

// Create dialog and link to button	
$( function() {
	$( "#callmod_dialog" ).dialog({
		autoOpen: false,
		resizable: false,
		show: {
			effect: "drop",
			direction:"down",
			duration: 500
		},
		hide: {
			effect: "drop",
			direction:"down",
			duration: 500
		},
		height: "auto",
		width: 400,
		modal: true,
		buttons: {
			"Sure": function() {
				client.sendZZ("");
				$( this ).dialog( "close" );
			},
			Cancel: function() {
				$( this ).dialog( "close" );
			}
		}
	});
});