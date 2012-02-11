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