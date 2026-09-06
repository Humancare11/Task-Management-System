// Chrome native-messaging wire format: a 4-byte little-endian uint32 length
// prefix followed by that many bytes of UTF-8 JSON. Pure codec — no I/O.

"use strict";

const MAX_MESSAGE_BYTES = 1024 * 1024; // Chrome's limit for extension -> host

function encode(obj) {
    const json = Buffer.from(JSON.stringify(obj), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(json.length, 0);
    return Buffer.concat([header, json]);
}

/**
 * Stateful decoder — feed it chunks, get back complete messages.
 * @returns {{ push(buf:Buffer): object[], reset(): void }}
 */
function createDecoder() {
    let acc = Buffer.alloc(0);
    return {
        push(buf) {
            acc = Buffer.concat([acc, buf]);
            const out = [];
            while (acc.length >= 4) {
                const len = acc.readUInt32LE(0);
                if (len > MAX_MESSAGE_BYTES) {
                    // Corrupt / hostile stream — drop everything and resync is
                    // impossible; caller should close.
                    throw new Error(`native message too large: ${len}`);
                }
                if (acc.length < 4 + len) break;
                const body = acc.slice(4, 4 + len);
                acc = acc.slice(4 + len);
                try {
                    out.push(JSON.parse(body.toString("utf8")));
                } catch {
                    /* skip an unparseable frame, keep going */
                }
            }
            return out;
        },
        reset() {
            acc = Buffer.alloc(0);
        },
    };
}

module.exports = { encode, createDecoder, MAX_MESSAGE_BYTES };
