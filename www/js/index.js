var app = {
	mode			: 'development',
	endPointDomain 	: null, 
	terminal_id 	: 1,
	terminal_info 	: null,
	initialize: function() {
		this.bindEvents();
	},
	currentLocation : null,
	locationTimerController : null,
	errors 	: [],
	// Bind Event Listeners
	//
	// Bind any events that are required on startup. Common events are:
	// 'load', 'deviceready', 'offline', and 'online'.
	bindEvents: function() {
		document.addEventListener('deviceready', this.onDeviceReady, false);
	},
	// deviceready Event Handler
	//
	// The scope of 'this' is the event. In order to call the 'receivedEvent'
	// function, we must explicitly call 'app.receivedEvent(...);'
	onDeviceReady: function() {
		app.receivedEvent('deviceready');
	},
	callServer: function(options){

		var deferred = Q.defer();

		var self 			= this;
		var requestType 	= options.requestType;
		var dataType 		= options.dataType; 
		var rest 			= options.rest + (options.requestType == "GET" ? ("?r=" + Math.random()) : "");
		var params 			= options.params;
		var callback 		= options.callback; 
		var connector 		= options.connector; 
		var errorCallback 	= options.errorCallback;
		
		if (self[connector]) {
			self.abortConnection(connector);
		}
		
		var self = this;

		var settings = {
			type: requestType,
			url: rest,
			dataType: dataType || 'json',
			success: function(data) {
				
				deferred.resolve(data);
				
			},
			error: function(XHR) {

				console.log(XHR.status);				
				deferred.reject(XHR);
				
			}
		}

		if (options.params != null) {
			settings.data = params
		}
		
		if (options.authorize == true) {
			//If authorization is required (Basic Authentication)
			settings.username = options.username;
			settings.password = options.password;
		}

		connector = $.ajax(settings);

		return deferred.promise;

	},
	sendLocation: function(location){

		var deferred = Q.defer();

		var xhr_options = {
			requestType 	: 'POST', 
			dataType 		: 'json',
			rest 			: app.endPointDomain + '/api/terminal/' + this.terminal_id + '/location/save',
			params 			: location, 
			authorize 		: false,
			connector 		: "nfc_connector"
		}
		
		app
			.callServer(xhr_options)
			.then(function(data){
				
				app.currentLocation = location;
				deferred.resolve();
				
			})
			.catch(function(xhr){
				console.error("Error: " + xhr.status);
				deferred.reject(xhr);
			})

		return deferred.promise;

	},
	stopSleep 	: function(){
		window.plugins.insomnia.keepAwake();
	},
	getDistance: function(geolocation_a, geolocation_b){

		if (typeof(Number.prototype.toRad) === "undefined") {
			Number.prototype.toRad = function() {
				return this * Math.PI / 180;
			}
		}

		var R = 6371; // km
		var dLat = (Number(geolocation_b.latitude) 	- Number(geolocation_a.latitude)).toRad();
		var dLon = (Number(geolocation_b.longitude) - Number(geolocation_a.longitude)).toRad();
		var lat1 = Number(geolocation_a.latitude).toRad();
		var lat2 = Number(geolocation_b.latitude).toRad();

		var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
		var d = R * c;

		console.log("Distance: " + d);

		return d;

	},
	processLocation: function(){

		var self = this;

		clearTimeout(app.locationTimerController);

		app.locationTimerController = setTimeout(function(){

			navigator.geolocation.getCurrentPosition(function(position){

				var location = {
					latitude            : position.coords.latitude,
					longitude           : position.coords.longitude,
					altitude            : position.coords.altitude,
					accuracy            : position.coords.accuracy,
					altitude_accuracy   : position.coords.altitudeAccuracy,
					heading             : position.coords.heading,
					speed               : position.coords.speed
				}

				if(
					app.currentLocation == null ||
					(
						app.currentLocation && 
						app.getDistance(app.currentLocation,location) > 5
					)
				){
					//JUST SEND LOCATION IF IS THE FIRST TIME OR IF DEVICE MOVED AT LEAST 5 METERS
					self.sendLocation(location).then(function(){
						clearTimeout(app.locationTimerController);
						app.processLocation();
					});
				} else {
					app.processLocation();
				}


			}, function(e){
				self.errors.push(e);
			});

		}, 10000);


	},
	interactWithStatusBar: function(){
		StatusBar.hide();
	},
	getTerminalInformation: function(){

		var deferred = Q.defer();

		var xhr_options = {
			requestType 	: 'GET',
			params 			: {}, 
			dataType 		: 'json',
			rest 			: (app.endPointDomain + '/api/terminal/' + this.terminal_id),
			authorize 		: false,
			connector 		: "nfc_connector"
		}

		app
			.callServer(xhr_options)
			.then(function(data){
				
				app.terminal_info = data;
				deferred.resolve();
				
			})
			.catch(function(xhr){
				console.error("Error: " + xhr.status);
				deferred.reject(xhr);
			})			


		return deferred.promise;

	},
	setEndPointDomain : function(){
		app.endPointDomain = (app.mode === 'development' ? 'http://192.168.2.10:3000' : 'https://monge-buses.herokuapp.com')
	},
	start:function(){


		app.setEndPointDomain();
		app.stopSleep();
		app.interactWithStatusBar();
		
		app.getTerminalInformation().then(function(){
			
			app.processLocation();
			
		})

	},
	receivedEvent: function(id) {

		var self = this;

		//var parentElement = document.getElementById(id);
		//var listeningElement = parentElement.querySelector('.listening');
		//var receivedElement = parentElement.querySelector('.received');

		//listeningElement.setAttribute('style', 'display:none;');
		//receivedElement.setAttribute('style', 'display:block;');

		app.start();

	}
};

app.initialize();