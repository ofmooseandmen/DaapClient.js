/*
 * Copyright (C) 2012 Cedric Liegeois.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 * Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */'use strict';

/**
 * DAAP Client. This client connects to the DAAP server at the specified IP address/port.
 * <p>
 * Since DaapClient.js relies on XmlHttpRequest to connect to the DAAP server, this latter shall 
 * allow Cross-Origin Ressource Sharing. If you cannot modify your DAAP server to include Access-Control-Allow-Origin 
 * in the response header, consider setting up a proxy such as (apache configuration file example):
 *
 * <p>
 * <pre>
 *"Listen 3690
 *
 * NameVirtualHost *:3690
 *
 * <VirtualHost *:3690>
 *   ProxyRequests On
 *   <Proxy>
 *     Order deny,allow
 *     Allow from all
 *   </Proxy>
 *
 *   ProxyPass / http://localhost:3689/
 *   ProxyPassReverse / http://localhost:3689/
 *   Header set Access-Control-Allow-Origin "*"
 *   Header set Access-Control-Allow-Methods "GET
 * </VirtualHost>"
 * </pre>
 * In which case DaapClient shall be constructed with port number 3690
 *
 * <p>
 * Example of use:
 * <pre>
 * // create the DaapClient, DAAP server IP address = 10.0.1.6; port = 3690.
 * var client = new DaapClient("10.0.1.6", 3690);
 *         
 * var streamsFetched = function streamsFetched(code, streams) {
 *     if (code == 200) {
 *         alert(streams[0].uri);
 *     } else {
 *         alert("Could not fetch streams: [HTML Status code = " + code + "]");
 *     }
 * };
 *           
 * var loginCompleted = function loginCompleted(code) {
 *     if (code == 200) {
 *         client.fetchStreams(streamsFetched);
 *     } else if (code == 401) {
 *         var passwd = prompt("Enter Password for DAAP server");
 *         client.secureLogin(passwd, loginCompleted);
 *     } else {
 * 	       alert("Could not login to the DAAP server: [HTML Status code = " + code + "]");
 *     }
 * };
 *          
 * // start with unsecure login - no password.
 * client.login(loginCompleted);
 * </pre>
 * 
 * @see http://www.w3.org/wiki/CORS_Enabled
 * 
 * @constructor
 * @param ip {String} the IP address of the DAAP Server
 * @param port {int} the port of the DAAP Server - if omitted, 3689 is assumed
 */
function DaapClient(ip, port) {

	/** @private the DAAP server. */
	var server;
	// if port not provided; port = 3689.
    if( typeof (port) == 'undefined') {
        server = "http://" + ip + ":/3689";
    } else {
        server = "http://" + ip + ":" + port;
    }

	/** @private the HTTP client to communicate with the server. */
	var httpClient = new DaapHttpClient(server);

	/** @private the session id. */
	var sid = null;

	/** @private the revision id. */
	var rid = null;

	@EndOfPacketException;

	@DaapPacket;

	@DaapHttpClient;

	@LoginRequestHandler;

	@UpdateRequestHandler;

	@DatabaseRequestHandler;

	@LoginListener;

	/**
	 * If SID or RID is <code>null</code> throws Error.
	 * 
	 * @private
	 */
	function checkLogin() {
		if(sid == null || rid == null) {
			throw new Error("Login not completed.");
		}
	}

	/**
	 * Log on to the DAAP server with the specified password.
	 *
	 * @param password the password to connect to the DAAP server - optional, if none provided no HTTP Authorization header will be sent
	 * @param callback the callback function called once the login phase is over. The HTML status code is returned.
	 */
	this.secureLogin = function(password, callback) {
		if( typeof (password) != 'undefined') {
			httpClient.setPassword(password);
		}
		this.login(callback);
	};
	
	/**
	 * Log on to the DAAP server.
	 *
	 * @param callback the callback function called once the login phase is over. The HTML status code is returned.
	 */
	this.login = function(callback) {
		var l = new LoginListener(callback);
		// retrieve session id.
		var handler = new LoginRequestHandler(l);
		httpClient.execute(handler);
	};
	
	/**
	 * Fetch all audio streams served by the DAAP server.
	 * <p>
	 * Each stream is described by the following JSON format:
	 * <ul>
	 * <li>uri : the address of the stream
	 * <li>trackNumber : the track number in the album
	 * <li>title : the stream title
	 * <li>album : the stream album
	 * <li>artist : the stream artist
	 * <li>genre : the stream genre
	 * <li>id : the DAAP ID of the stream
	 * <li>
	 * </ul>
	 * <p>
	 * @param callback the callback function called once the streams have been fetched. Callback is called with HTML status code and an array of stream or 'undefined' if the the status code is not <code>200</code>.
	 */
	this.fetchStreams = function(callback) {
		checkLogin();
		var handler = new DatabaseRequestHandler(sid, rid, server, callback);
		httpClient.execute(handler);
	};
	
}