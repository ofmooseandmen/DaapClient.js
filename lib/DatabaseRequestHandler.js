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

    var fields = ["dmap.itemid", "daap.songformat", "dmap.itemname", "daap.songalbum", "daap.songartist", "daap.songgenre", "daap.songtracknumber"];

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
        for(var i = 0; i < mlitsLength; i++) {
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
        var result = {
            uri : uri,
            trackNumber : trackNumber,
            title : title,
            album : album,
            artist : artist,
            genre : genre,
            id : id
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
        if(chunk != null) {
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
        if(chunk != null) {
            result = chunk.convertToString();
        }
        return result;
    }

}