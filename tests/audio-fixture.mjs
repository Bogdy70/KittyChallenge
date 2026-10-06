// Silent PCM for browser/API checks; no voices, keys or network services required.
export function wav(seconds = 3) {
  const samples = Math.round(8000 * seconds),
    bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples * 2, 40);
  return bytes;
}
export function audioUpload(bytes, metadata) {
  const json = Buffer.from(JSON.stringify(metadata)),
    head = Buffer.alloc(4);
  head.writeUInt32BE(json.length);
  return Buffer.concat([head, json, bytes]);
}
