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
            if(this.readyState == 4) {
                if(this.status != 200) {
                    request.fail(this.status);
                } else {
                    try {
                        var packet = new DaapPacket(xhr.responseText);
                        request.handleResponse(packet);
                    } catch (e) {
                        if( e instanceof EndOfPacketException) {
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
        if(!('overrideMimeType' in xhr)) {
            throw new Error("Your browser does not support binary encoding, aborting ...");
        }
        xhr.overrideMimeType('text/plain; charset=x-user-defined');
        // add basic authentication is password provided.
        if(encodedPassword != null) {
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