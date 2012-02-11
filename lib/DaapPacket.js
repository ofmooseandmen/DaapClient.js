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
    if( typeof (start) == 'undefined') {
        start = 0;
    }

    /** @private the current offset - initialize @ 0; used to read through the chunk. */
    var offset = 0;
    var length = chunk.length - start;
    // check data holds at least 8 bytes; header + size:
    if(length < HEADER_LENGTH) {
        throw new EndOfPacketException();
    }

    // first 4 bytes is the DAAP code of this chunk.
    var code = chunk.substring(start, start + CODE_LENGTH);

    // next 4 bytes is the size
    var size = readUInt32(chunk, start + CODE_LENGTH);

    // check data holds at least computed size
    if(length < HEADER_LENGTH + size) {
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
        while(true) {
            try {
                result = this.readNextChunk();
                if(result.codeEquals(refCode)) {
                    break;
                }
            } catch (e) {
                if( e instanceof EndOfPacketException) {
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
        while(true) {
            try {
                next = this.readNextChunk();
                if(next.codeEquals(refCode)) {
                    result.push(next);
                }
            } catch (e) {
                if( e instanceof EndOfPacketException) {
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