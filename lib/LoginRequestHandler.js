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