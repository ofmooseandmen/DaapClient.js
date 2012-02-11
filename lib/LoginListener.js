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