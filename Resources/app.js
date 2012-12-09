// this sets the background color of the master UIView (when there are no windows/tab groups on it)
Titanium.UI.setBackgroundColor('#000');

// create tab group
var tabGroup = Titanium.UI.createTabGroup();
//
// create base UI tab and root window
//
var win1 = Titanium.UI.createWindow({  
    title:'Stations',
    backgroundColor:'#fff'
});
var tab1 = Titanium.UI.createTab({  
    title:'Stations',
    window:win1,
});

var win3 = Titanium.UI.createWindow({  
    title:'Now Playing',
    backgroundColor:'#fff'
});
var tab3 = Titanium.UI.createTab({  
    title:'Now Playing',
    window:win3,
});

/*
var label1 = Titanium.UI.createTextArea({
	color:'#999',
	text:'Loading...',
	font:{fontSize:20,fontFamily:'Helvetica Neue'},
	textAlign:'center',
});

win1.add(label1);
*/

var win2 = Titanium.UI.createWindow({  
    title:'Settings',
    backgroundColor:'#fff'
});
var tab2 = Titanium.UI.createTab({  
    title:'Settings',
    window:win2,
});

tabGroup.addTab(tab3);  
tabGroup.addTab(tab1);  
tabGroup.addTab(tab2);  

// open tab group
tabGroup.open();

var loggedin = 0;
var connected = 0;
var status = Ti.createBuffer({ value: 'status\n' });
var socket = null;
var response = [];
var stations = [];
songObjects = {};

if(!Ti.App.Properties.getString("pianod_server"))
	Ti.App.Properties.setString("pianod_server", "127.0.0.1");
if(!Ti.App.Properties.getString("pianod_port"))
	Ti.App.Properties.setString("pianod_port", "4445");
if(!Ti.App.Properties.getString("pianod_username"))
	Ti.App.Properties.setString("pianod_username", "admin");
if(!Ti.App.Properties.getString("pianod_password"))
	Ti.App.Properties.setString("pianod_password", "password");

var max_response = 4000;
var curr_line = "";
var debug = 0;
var stationView = null;
var stationTop = 0;
var currentStation = null;
var song_changed = 0;
var currentSong = null;
var songView = Ti.UI.createScrollView();
var songTop = 0;

var coverArt = Ti.UI.createImageView({
  height : "50%",
  width : "auto",
  bottom : 100,
  load : function(e) { updateStatus(false); },
});
coverArt.setImage("music.png");

var activityIndicator = Ti.UI.createActivityIndicator({
  color: 'green',
  font: {fontFamily:'Helvetica Neue', fontSize:26, fontWeight:'bold'},
  message: 'Loading...',
  style:Ti.UI.iPhone.ActivityIndicatorStyle.DARK,
  top:10,
  left:10,
  height:'auto',
  width:'auto'
});

if (Ti.Platform.name === 'iPhone OS') {
    win2.add(activityIndicator);
}

function printf(msg) {
  activityIndicator.message = msg + "\n"; 
  activityIndicator.show();
    Ti.API.info(msg + "\n");
}

function pianodDisconnect(msg) {
    activityIndicator.hide();
	if(currentStation)
	   currentStation = null; 
	if(connected) {
		socket.close();
		socket = null;
		connected = 0;
		loggedin = 0;
	}
	if(msg != undefined)
        alert(msg);
}

function getPianodLines(success1, success2, success3) {
	var buffer = Ti.createBuffer({ length: 1 });
	var resp = [];
	var line = "";
	var total = 0;	
	
	if(!connected) {
		printf("Not connected. Ignoring request");
		return resp;
	}
	
	while(total++ < max_response) {
		var len = socket.read(buffer);
		if(len < 0) {
			pianodDisconnect("Error getting response from pianod");
			return resp;
		}
		
		var byte = buffer.toString();
		
		if(byte == undefined) {
		    pianodDisconnect("byte is undefined. wtf?");
		    return resp;
		} else if(byte == '\n') {
			var parts = line.split(" ");
			var code = parseInt(parts[0]);
			var value = "";
			for(var x = 1; x < parts.length; x++)
			     value += parts[x] + " ";
			value = value.replace(/^\s+|\s+$/g, '');
			var stop = 0;	
			
			if(code == 101) {
				if(success1 != 101 && (success2 != -1 && success2 != 101) && (success3 != -1 && success3 != 101)) {
					line = "";
					if(debug)
					printf("Ignoring current track");
					continue;
				}
			} else if(code == 102) {
                if(success1 != 102 && (success2 != -1 && success2 != 102) && (success3 != -1 && success3 != 102)) {
                    line = "";
                    if(debug)
                    printf("Ignoring current track");
                    continue;
                }
            } else if(code == 100) {
                    line = "";
                    if(debug)
                    printf("Ignoring welcome.");
                    continue;
            } else if(code == 203) {
                    if(debug)
                    printf("Status code: " + code + " value: " + value);
            } else if(code > 100 && code < 200) {
                    if(debug)
                    printf("Info code: " + code + " value: " + value);
            } else if(code >= 200 && code <= 299) {
                    if(debug)
                    printf("Success code: " + code + " value: " + value);
            } else if(code >= 400 && code <= 499) {
                    if(debug)
                    printf("Error code: " + code + " value: " + value);
                    stop = 1;
            } else {
                    if(debug)
                    printf("Unknown code: " + code + " value: " + value);
            }
            line = "";
            resp.push({"code" : code, "value" : value});
            if(stop || (success1 == code) || (success2 != -1 && success2 == code) || (success3 != -1 && success3 == code))
                    break;
            if(debug)
                printf("Not stopping: " + code + " != " + success1);
		} else {
			line += byte;
		}
	}
	
	if(total >= max_response)
		resp.push({"code" : 400, "value" : "Response was too big, assuming error."});
	
	return resp;
}

function CheckForResponse(success1, success2, success3, len) {
    response = null;
    response = [];
    if(len > 0)
        response = getPianodLines(success1, success2, success3);
    else
        printf("Failed to send pianod request");
}

function SendPianodRequest(success, cmd) {
    if(connected) {
        var buffer = Ti.createBuffer({ value: cmd + "\n" });
        var len = socket.write(buffer);
        if(!len) {
            pianodDisconnect("Error sending: " + cmd + ": got zero bytes");
            return 0;
        }
        CheckForResponse(success, -1, -1, len);
        return len;
    }
    return 0;
}

function reconnect() {
	if(connected)
		pianodDisconnect(undefined);
	
	socket = Ti.Network.Socket.createTCP({
	    host: Ti.App.Properties.getString("pianod_server"), 
    	port: parseInt(Ti.App.Properties.getString("pianod_port")),
	    connected: function (e) {
	        connected = 1;
	    },
        error: function (e) {
	        printf('Error (' + e.errorCode + '): ' + e.error);
        	if(connected)
        		pianodDisconnect('Error (' + e.errorCode + '): ' + e.error);
	    },
	});
	
	socket.connect();
}

function back() {
    return response[response.length - 1];
}
function PullOutSong() {
    var song = {};
    while(response.length) {
        r = response.shift();
        if(r.code == 204 || r.code == 203) {
            break;
        } else {
			var parts = r.value.split(":");
			var key = parts[0].replace(/^\s+|\s+$/g, '');
			var value = "";
			for(var x = 1; x < parts.length; x++)
			     value += parts[x] + " ";
			value = value.replace(/^\s+|\s+$/g, '');
			labelkey = key.toLowerCase();
			song[labelkey] = value;
        }
    }
    return song;
}
function updateStatus(check_anyway) {
    var found_song = 0;
    if(!check_anyway && (!connected || !loggedin || !currentStation))
        return found_song;
        
    if(SendPianodRequest(204, "status")) {
        if(back().code == 204) {
            while(response.length) {
                r = response.shift();
                if(r.code == 203) {
                   var song = PullOutSong();
                   if(song.length != 0) {
                       if(!currentSong || currentSong.title != song.title) {
                           currentSong = song;
                           song_changed = 1;
                			for(var labelkey in song) {
                			    if(labelkey in songObjects)
                        			songObjects[labelkey].setText(song[labelkey]);
                			}
                			url = song.coverart;
                			if(url != undefined) {
                			    url = url.replace(" ", ":");
                    			coverArt.setImage(url);
                            }
                       }
                       found_song = 1;
                   }
                }
            }
        } else {
            pianodDisconnect("Failed to get current song status");
            return found_song;
        }
    }
    
    if(found_song) {
        CheckForResponse(101, 102, 104, 1);
        
        r = back();
        
        if(r.code == 101 || r.code == 102 || r.code == 104) {
             var parts = r.value.split(" ");
             var times = parts[0].split("/");
             var played = times[0];
             var duration = times[1]; 
             if(!currentStation) {
                 currentStation = "";
                 parts.shift();
                 parts.shift();
                 for(var x = 0; x < parts.length; x++)
                    currentStation += parts[x] + " "; 
             }
             songObjects["status"].setText(played + " / " + duration);
        } else {
            pianodDisconnect("Failed to get duration of current song");
            return found_song;
        }
        
        setTimeout(function() { updateStatus(false) }, 1000);
    }
    
    return found_song;
}

function newStation(label) {
	var stationLabel = Ti.UI.createLabel({ 
	  shadowColor: '#aaa',
	  shadowOffset: {x:5, y:5},
	  left : 20,
	  text: label,
	  textAlign: Ti.UI.TEXT_ALIGNMENT_CENTER,
	});
	
	var stationRow = Titanium.UI.createView({top:stationTop, height: 70});
	stationRow.addEventListener("click", function(e) {
	    if(stations.length == 0) {
	        alert("Empty playlist. Please add some stations =)");
	        return;
	    }
	    if(SendPianodRequest(200, "select station \"" + label + "\"")) {
    	    if(currentStation) {
        	    if(!SendPianodRequest(200, "skip"));
        	       return;
        	}
        	currentStation = label;
    	    printf("Loading...");
        	if(SendPianodRequest(200, "play")) {
        	    
                tabGroup.setActiveTab(tab3);
                setTimeout(function() { updateStatus(false) }, 1000);
        	}
            activityIndicator.hide();
	    }
	});
	stationRow.add(stationLabel);
	stationView.add(stationRow);
	stationTop += 70;
}

function RepopulateStations() {
    printf("Retrieving station list...");
    stationTop = 0;
    if(stationView) {
        win1.remove(stationView);
        stationView = null;
    }
    stationView = Ti.UI.createScrollView();
    stations = null;    stations = [];
    
    if(SendPianodRequest(204, "stations list")) {
        if(back().code == 204) {
            while(response.length > 0) {
                r = response.shift();
                if(r.code != 115)
                    continue;
                s = r.value.substr(9);
                //printf("Adding station: " + s);
                stations.push(s);
                newStation(s);
            }
        } 
    }
    win1.add(stationView);
}

function login(e) {
    if(stationView) {
        win1.remove(stationView);
        stationView = null;
    }
    
	if(!connected) {
		printf("Connecting...");	
		reconnect();
	}
	
	if(!connected) {
		setTimeout(function() {login(undefined)}, 1000);
		return;
	}
	
	if(!loggedin) {
    	response = getPianodLines(200, -1, -1);
    	if(response.length != 1) {
    		pianodDisconnect("too many initial responses.");
    		return;
    	}
    	
    	if(response[0].code != 200) {
    		pianodDisconnect("Nonsucessful attempt on initial connection.");
    		return;
    	}
    	
    	printf("Authenticating...");
    	if(SendPianodRequest(200, "user " + Ti.App.Properties.getString("pianod_username") + " " + Ti.App.Properties.getString("pianod_password"))) {
        	if(back().code != 200) {
        	    pianodDisconnect("Authentication failed: " + back().value);
        	    return;
        	}
        	
        	loggedin = 1;
            tabGroup.setActiveTab(tab2);
    	} else {
           activityIndicator.hide();
    	   return;
	   }
	}
	
	RepopulateStations();
    activityIndicator.hide();
    var now_playing = updateStatus(true);
    if(now_playing == 1) {
        tabGroup.setActiveTab(tab3);
    } else {
        tabGroup.setActiveTab(tab1);
    }
}

/* Populate the UI for the Pianod settings */

var scrollView = Ti.UI.createScrollView();
var currTop = 0;

function newSetting(label, name) {
	var settingLabel = Ti.UI.createLabel({ 
	  shadowColor: '#aaa',
	  shadowOffset: {x:5, y:5},
	  left : 20,
	  text: label + ": ",
	  textAlign: Ti.UI.TEXT_ALIGNMENT_LEFT,
	});
	
	var settingInput = Ti.UI.createTextField({ 
			borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED, 
			color: '#336699', height: 50, top: 10, width: "50%", right : 20,
				font : {
	            fontSize : 20,
	            fontColor : '#ff7c00',
	            fontWeight : 'bold',
	            fontFamily : 'Helvetica Neue'
	        }
			 });
			 
	if(name.split("pass").length > 1)
    	settingInput.setPasswordMask(true);
			
	settingInput.addEventListener('blur', function(e) { Ti.App.Properties.setString(name, e.value); reconnect(null);});
	settingInput.value = Ti.App.Properties.getString(name);	
	
	var settingRow = Titanium.UI.createView({top:currTop, height: 70});
	settingRow.add(settingLabel);
	settingRow.add(settingInput);
	
	scrollView.add(settingRow);
	currTop += 70;
}
win2.add(scrollView);

newSetting("Pianod Address", "pianod_server");
newSetting("Pianod Port", "pianod_port");
newSetting("Pianod Username", "pianod_username");
newSetting("Pianod Password", "pianod_password");

win2.add(scrollView);
activityIndicator.hide();

var button = Titanium.UI.createButton({
   title: 'Login to Pianod',
   bottom: 10,
   width: "50%",
   height: "10%",
});

button.addEventListener('click', login);

win2.add(button);

var playButton = Titanium.UI.createButton({
   title: 'PlayPause',
   width: "30%",
   height: "7%",
   bottom : 10,
   right : 5,
});

function playpause(e) {
    if(currentStation)
        SendPianodRequest(200, "playpause");
}

playButton.addEventListener('click', function(e) { if(currentStation) SendPianodRequest(200, "playpause");}); 

var stopButton = Titanium.UI.createButton({
   title: 'Stop',
   width: "30%",
   height: "7%",
   bottom : 10,
});

stopButton.addEventListener('click', function(e) { if(currentStation) SendPianodRequest(200, "stop now");}); 

var skipButton = Titanium.UI.createButton({
   title: 'Skip',
   width: "30%",
   height: "7%",
   bottom : 10,
   left : 5,
});

skipButton.addEventListener('click', function(e) { if(currentStation) SendPianodRequest(200, "skip");}); 

function newSong(label, name) {
	var songLabel = Ti.UI.createLabel({ 
	  shadowColor: '#aaa',
	  shadowOffset: {x:5, y:5},
	  left : 20,
	  text: label + ": ",
	  textAlign: Ti.UI.TEXT_ALIGNMENT_CENTER,
	});
	var songDesc = Ti.UI.createLabel({ 
	  shadowColor: '#aaa',
	  shadowOffset: {x:5, y:5},
	  width : "70%",
	  right : 20,
	  text: "not logged in",
	  textAlign: Ti.UI.TEXT_ALIGNMENT_CENTER,
	});
	
	var songRow = Titanium.UI.createView({top:songTop, height: 40});
	songRow.add(songLabel);
	songRow.add(songDesc);
	songObjects[name] = songDesc;
	songView.add(songRow);
	songTop += 40;
}

newSong("Title", "title");
newSong("Artist", "artist");
newSong("Album", "album");
newSong("Station", "station");
newSong("Status", "status");

win3.add(songView);
win3.add(coverArt);
win3.add(playButton);
win3.add(stopButton);
win3.add(skipButton);
if(!connected || !loggedin)
    tabGroup.setActiveTab(tab2);