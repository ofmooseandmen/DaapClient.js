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
 */
'use strict';

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
    if (typeof(port) == 'undefined') {
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

    /**
     * An Exception thrown when the end of DAAP packet has been reached.
     *
     * @constructor
     */

    function EndOfPacketException() {

    }

    /**
     * The DAAP response definition: a packet organized by 'codes' and 'values'. The basic format of DAAP is:
     *
     * <pre>
     *   4 byte tag | size (4 byte int) | data
     * </pre>
     *
     * where the length of the data is determined by the size. The 4 byte tag can be represented as either an integer,
     * or as a four character string.
     * <p>
     * The data can itself be either:
     * <ul>
     * <li>the actual transmitted data: an <code>int</code> or a <code>String</code>
     * <li>a sequence of chunks (from <code>1<code> to <code>n</code>)
     * </ul>
     *
     * @see <a href="http://tapjam.net/daap">DAAP Protocol documentation v0.2</a>
     *
     * @constructor
     * @param chunk {String}
     *            a string representing a DAAP chunk (code + size +
     *            data).
     * @param start {int}
     *            the offset at which to start reading the chunk - if omitted, 0 is assumed
     * @throws EndOfPacketException
     *             if the string does not hold enough information to
     *             extract code + data.
     */

    function DaapPacket(chunk, start) {

        /** @private size in bytes of "code" of chunk. */
        var CODE_LENGTH = 4;

        /** @private size in bytes of "size" of chunk. */
        var SIZE_LENGTH = 4;

        /** @private size in bytes of "header" of chunk. */
        var HEADER_LENGTH = CODE_LENGTH + SIZE_LENGTH;

        // if start is not provided, start = 0.
        if (typeof(start) == 'undefined') {
            start = 0;
        }

        /** @private the current offset - initialize @ 0; used to read through the chunk. */
        var offset = 0;
        var length = chunk.length - start;
        // check data holds at least 8 bytes; header + size:
        if (length < HEADER_LENGTH) {
            throw new EndOfPacketException();
        }

        // first 4 bytes is the DAAP code of this chunk.
        var code = chunk.substring(start, start + CODE_LENGTH);

        // next 4 bytes is the size
        var size = readUInt32(chunk, start + CODE_LENGTH);

        // check data holds at least computed size
        if (length < HEADER_LENGTH + size) {
            throw new EndOfPacketException();

        }

        /** @private the binary data that hold the content of this packet. */
        // data is next spanning over 'size'. the byte array holding the data associated to the DAAP code.
        var data = chunk.substring(start + HEADER_LENGTH, start + HEADER_LENGTH + size);

        /**
         * Read the next chunk within this chunk.
         * <p>
         * Note: it is up to the user to use this method as long as the data associated to the returned chunk do contain
         * yet other chunks. Once the return chunk contains the actual transmitted data use
         * {@link DaapPacket#convertToInt()} or {@link DaapPacket#convertToString()}. Calling this method on an actual
         * data will throw a {@link EndOfPacketException}.
         *
         * @return the next read chunk
         * @throws EndOfPacketException if no next chunk can be read.
         */
        this.readNextChunk = function() {
            var result = new DaapPacket(data, offset);
            offset += result.size();
            return result;
        };

        /**
         * Return <code>true</code> if the specified code equals this code. Comparison is made at byte level.
         *
         * @param other {String} the specified code
         * @return <code>true</code> if the specified String equals this code
         */
        this.codeEquals = function(other) {
            return code == other;
        };

        /**
         * Return the size of this chunk including 'code' and 'size'.
         *
         * @return the size of this chunk
         */
        this.size = function() {
            return data.length + HEADER_LENGTH;
        };

        /**
         * Convert the data associated to this packet into an <code>int</code>.
         *
         * @return the data associated to this packet converted into an <code>int</code>.
         */
        this.convertToInt = function() {
            return readUInt32(data, 0);
        };

        /**
         * Convert the data associated to this packet into a <code>String</code>.
         *
         * @return the data associated to this packet converted into a <code>String</code>.
         */
        this.convertToString = function() {
            return data;
        };

        /**
         * Seek this packet for the specified code and return first packet with matching code.
         *
         * @param refCode {String} the specified code
         * @return the first {DaapPacket} which code matches the specified one.
         */
        this.seekFirst = function(refCode) {
            // reset offset to seek for specified code throughout all data.
            offset = 0;
            var result = null;
            while (true) {
                try {
                    result = this.readNextChunk();
                    if (result.codeEquals(refCode)) {
                        break;
                    }
                } catch (e) {
                    if (e instanceof EndOfPacketException) {
                        result = null;
                        break;
                    } else {
                        throw e;
                    }
                }
            }
            return result;
        };

        /**
         * Seek this packet for the specified code and return all packets with matching code.
         *
         * @param refCode {String} the specified code
         * @return an array of {DaapPacket} which code matches the specified one.
         */
        this.seek = function(refCode) {
            // reset offset to seek for specified code throughout all data.
            offset = 0;
            var result = [];
            var next;
            while (true) {
                try {
                    next = this.readNextChunk();
                    if (next.codeEquals(refCode)) {
                        result.push(next);
                    }
                } catch (e) {
                    if (e instanceof EndOfPacketException) {
                        break;
                    } else {
                        throw e;
                    }
                }
            }
            return result;
        };

        /**
         * Read big-endian (network byte order) unsigned 32-bit <code>int</code> from data at offset
         *
         * @see http://fhtr.blogspot.com/2009/12/3d-models-and-parsing-binary-data-with.html
         *
         * @param data {String} data to read from
         * @param offset {int} offset
         * @return the read unsigned 32-bit
         */

        function readUInt32(data, offset) {
            return ((data.charCodeAt(offset) & 0xFF) << 24) + ((data.charCodeAt(offset + 1) & 0xFF) << 16) + ((data.charCodeAt(offset + 2) & 0xFF) << 8) + (data.charCodeAt(offset + 3) & 0xFF);
        }

    }

    /**
     * The DAAP HTTP client based on XMLHttpRequest.
     *
     * @constructor
     * @param aServer {String} the DAAP Server.
     */

    function DaapHttpClient(aServer) {

        /** @private the DAAP server. */
        var server = aServer;

        /** @private the base 64 encoded password for authentication. */
        var encodedPassword = null;

        /**
         * Execute the specified request.
         * <p>
         * request shall provide handleResponse and getUri methods.
         *
         * @see http://badassjs.com/post/694057326/binaryreader-js-parsing-binary-data-in-javascript
         * @param request {Object} the request to execute.
         */
        this.execute = function(request) {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (this.readyState == 4) {
                    if (this.status != 200) {
                        request.fail(this.status);
                    } else {
                        try {
                            var packet = new DaapPacket(xhr.responseText);
                            request.handleResponse(packet);
                        } catch (e) {
                            if (e instanceof EndOfPacketException) {
                                request.fail(400);
                            } else {
                                throw e;
                            }
                        }
                    }
                }
            };


            xhr.open("GET", "http://" + ip + ":" + port + "/" + request.getUri(), true);

            // The following line says we want to receive data as Binary and not as Unicode
            if (!('overrideMimeType' in xhr)) {
                throw new Error("Your browser does not support binary encoding, aborting ...");
            }
            xhr.overrideMimeType('text/plain; charset=x-user-defined');
            // add basic authentication is password provided.
            if (encodedPassword != null) {
                xhr.setRequestHeader('Authorization', 'Basic ' + encodedPassword);
            }
            xhr.send();
        };

        /**
         * Set the password use for HTTP authentication.
         *
         * @param password the password - plain text (not base64 encoded)
         */
        this.setPassword = function(password) {
            // use built-in base64 encoder, maybe one day IE will implement it...
            encodedPassword = btoa("admin:" + password);
        };

    }

    /**
     * Login request handler; retrieves session ID and is a callback for {DaapHttpClient#execute(request)}.
     *
     * @constructor
     * @param l {Object} the listener
     */

    function LoginRequestHandler(l) {

        /** @private the listener. */
        var listener = l;

        /**
         * Handle the response of the DAAP server to the login request.
         * <p>
         * Fires sidUpdated event.
         *
         * @param packet {Object} the DAAP packet received from the server upon login request
         */
        this.handleResponse = function(packet) {
            var sid = packet.seekFirst('mlid').convertToInt();
            l.sidUpdated(sid);
        };


        this.fail = function(code) {
            l.fail(code);
        };

        /**
         * Returns the login request URI.
         *
         * @return the login request URI
         */
        this.getUri = function() {
            return "login";
        };

    }

    /**
     * Update request handler; retrieves revision ID and is a callback for {DaapHttpClient#execute(request)}.
     *
     * @constructor
     * @param l {Object} the listener
     * @param aSid {String} the DAAP session ID
     */

    function UpdateRequestHandler(aSid, l) {

        /** @private the DAAP session ID. */
        var sid = aSid;

        /** @private the listener. */
        var listener = l;

        /**
         * Handle the response of the DAAP server to the update request.
         * <p>
         * Fires ridUpdated event.
         *
         * @param packet {Object} the DAAP packet received from the server upon update request
         */
        this.handleResponse = function(packet) {
            var rid = packet.seekFirst('musr').convertToInt();
            l.ridUpdated(rid);
        };


        this.fail = function(code) {
            l.fail(code);
        };

        /**
         * Returns the update request URI.
         *
         * @return the update request URI
         */
        this.getUri = function() {
            return "update?session-id=" + sid;
        };

    }

    /**
     * Database request handler; retrieves all the songs in the database of the DAAP server
     *
     * @constructor
     * @param aSid {String} the DAAP session ID
     * @param aRid {String} the DAAP revision ID
     * @param aServer {String} the DAAP server IP address
     * @param l {Object} the listener
     */

    function DatabaseRequestHandler(aSid, aRid, aServer, aCallback) {

        /** @private the DAAP session ID. */
        var sid = aSid;

        /** @private the DAAP revision ID. */
        var rid = aRid;

        /** @private the DAAP server IP address. */
        var server = aServer;

        /** @private the callback. */
        var callback = aCallback;

        var fields = [
            "dmap.itemid",
            "daap.songformat",
            "dmap.itemname",
            "daap.songalbum",
            "daap.songartist",
            "daap.songgenre",
            "daap.songtracknumber",
            "daap.songtime",
            "daap.songsize",
            "daap.songyear",
            "daap.songbitrate"
            ];

        /**
         * Handle the response of the DAAP server to the database request.
         * <p>
         * Fires streamsFetched event.
         *
         * @param packet {Object} the DAAP packet received from the server upon database request
         */
        this.handleResponse = function(packet) {
            var mlcl = packet.seekFirst("mlcl");
            var mlits = mlcl.seek("mlit");
            var mlitsLength = mlits.length;
            var audioStreams = [];
            for (var i = 0; i < mlitsLength; i++) {
                audioStreams.push(createDaapStream(mlits[i]));
            }
            callback(200, audioStreams);
        };


        this.fail = function(code) {
            callback(code, undefined);
        };

        /**
         * Returns the database request URI.
         *
         * @return the database request URI
         */
        this.getUri = function() {
            return "databases/1/items?type=music&session-id=" + sid + "&revision-id=" + rid + "&meta=" + fields.join();
        };

        function createDaapStream(mlit) {
            var daapSongId = extractInt(mlit, "miid");
            var songFormat = extractString(mlit, "asfm");
            var uri = server + "/databases/1/items/" + daapSongId + "." + songFormat + "?session-id=" + sid;
            // song id is <session-id>-<song-id>
            var id = sid + "-" + daapSongId;
            var trackNumber = extractInt(mlit, "astn");
            var title = extractString(mlit, "minm");
            var album = extractString(mlit, "asal");
            var artist = extractString(mlit, "asar");
            var genre = extractString(mlit, "asgn");
            var duration = extractInt(mlit, "astm");
            var size = extractInt(mlit, "assz");
            var bitrate = extractInt(mlit, "asbr");
            var year = extractInt(mlit, "asyr");
            var result = {
                uri: uri,
                trackNumber: trackNumber,
                title: title,
                album: album,
                artist: artist,
                genre: genre,
                id: id,
                duration: duration,
                size: size,
                format: songFormat,
                bitrate: (bitrate >> 16),
                year: (year >> 16)
            };
            return result;
        }

        /**
         * Extract the <code>int</code> value corresponding to the specified code.
         *
         * @param packet {DaapPacket} the DAAP chunk from which the extract the value.
         * @param code {String} the specified code
         * @return the <code>int</code> value corresponding to the specified code
         */

        function extractInt(packet, code) {
            var chunk = packet.seekFirst(code);
            var result = -1;
            if (chunk != null) {
                result = chunk.convertToInt();
            }
            return result;
        }

        /**
         * Extract the <code>String</code> value corresponding to the specified code.
         *
         * @param packet {DaapPacket} the DAAP chunk from which the extract the value.
         * @param code {String} the specified code
         * @return the <code>String</code> value corresponding to the specified code
         */

        function extractString(packet, code) {
            var chunk = packet.seekFirst(code);
            var result = "";
            if (chunk != null) {
                result = chunk.convertToString();
            }
            return result;
        }

    }

    /**
     * The Login listener.
     * <p>
     * Login to a DAAP server is a two-step processing: first retrieve the Session ID (SID) and then the Revision ID (RID).
     *
     * @constructor
     * @param aCallback the callback function to be called once login phase is completed (SID and RID retrieved)
     */

    function LoginListener(aCallback) {

        /** @private the callback function. */
        var callback = aCallback;

        /**
         * Session ID updated event handler.
         * <p>
         * Once SID has been computed, RID shall be retrieved.
         *
         * @param aSid the updated SID
         */
        this.sidUpdated = function(aSid) {
            sid = aSid;
            // retrieve revision id.
            var handler = new UpdateRequestHandler(sid, this);
            httpClient.execute(handler);
        };

        /**
         * Revision ID updated event handler.
         * <p>
         * Both SID and RID have been computed, login phase is over.
         *
         * @param aRid the updated RID
         */
        this.ridUpdated = function(aRid) {
            rid = aRid;
            callback(200);
        };


        this.fail = function(code) {
            callback(code);
        };

    }

    /**
     * If SID or RID is <code>null</code> throws Error.
     *
     * @private
     */

    function checkLogin() {
        if (sid == null || rid == null) {
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
        if (typeof(password) != 'undefined') {
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
