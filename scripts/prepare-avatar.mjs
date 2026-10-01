import fs from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';

// Keep the original upload intact; produce a browser-sized copy with its original UVs.
const inputFile = process.argv[2] ?? 'low+poly+head+3d+model.glb';
const outputFile = process.argv[3] ?? 'avatar.glb';
const targetTriangles = Number(process.argv[4] ?? 100000);
const source = fs.readFileSync(new URL(`../${inputFile}`, import.meta.url));
const jsonLength = source.readUInt32LE(12);
const input = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const binary = source.subarray(28 + jsonLength);
function accessor(index, Type, components) {
  const a = input.accessors[index];
  const view = input.bufferViews[a.bufferView];
  const bytes = binary.subarray((view.byteOffset ?? 0) + (a.byteOffset ?? 0),
    (view.byteOffset ?? 0) + (a.byteOffset ?? 0) + a.count * components * Type.BYTES_PER_ELEMENT);
  return new Type(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const primitive = input.meshes[0].primitives[0];
const positions = accessor(primitive.attributes.POSITION, Float32Array, 3);
const uv = accessor(primitive.attributes.TEXCOORD_0, Float32Array, 2);
const indices = accessor(primitive.indices, Uint32Array, 1);
await MeshoptSimplifier.ready;
const [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(
  indices, positions, 3, uv, 2, [1, 1], null, targetTriangles * 3, 0.002, ['Permissive'],
);
const [remap, count] = MeshoptSimplifier.compactMesh(simplified);
const compactPositions = new Float32Array(count * 3);
const compactUV = new Float32Array(count * 2);
for (let i = 0; i < remap.length; i++) {
  if (remap[i] === 0xffffffff) continue;
  compactPositions.set(positions.subarray(i * 3, i * 3 + 3), remap[i] * 3);
  compactUV.set(uv.subarray(i * 2, i * 2 + 2), remap[i] * 2);
}
const material = input.materials[primitive.material];
const image = input.images[input.textures[material.pbrMetallicRoughness.baseColorTexture.index].source];
const imageView = input.bufferViews[image.bufferView];
const imageBytes = binary.subarray(imageView.byteOffset, imageView.byteOffset + imageView.byteLength);
const views = [];
const chunks = [];
let offset = 0;
for (const data of [compactPositions, compactUV, simplified, imageBytes]) {
  const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
  const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4);
  bytes.copy(padded);
  chunks.push(padded);
  offset += padded.length;
}
const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < compactPositions.length; i++) {
  minimum[i % 3] = Math.min(minimum[i % 3], compactPositions[i]);
  maximum[i % 3] = Math.max(maximum[i % 3], compactPositions[i]);
}
const output = {
  asset: { version: '2.0', generator: 'meshoptimizer: UV-preserving browser copy' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
  textures: [{ source: 0 }], images: [{ bufferView: 3, mimeType: image.mimeType }],
  accessors: [
    { bufferView: 0, componentType: 5126, count, type: 'VEC3', min: minimum, max: maximum },
    { bufferView: 1, componentType: 5126, count, type: 'VEC2' },
    { bufferView: 2, componentType: 5125, count: simplified.length, type: 'SCALAR' },
  ],
  bufferViews: views, buffers: [{ byteLength: offset }],
};
const json = Buffer.from(JSON.stringify(output));
const paddedJSON = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
json.copy(paddedJSON);
const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + paddedJSON.length + offset, 8);
header.writeUInt32LE(paddedJSON.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
binaryHeader.writeUInt32LE(offset, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
const result = Buffer.concat([header, paddedJSON, binaryHeader, ...chunks]);
fs.writeFileSync(new URL(`../public/${outputFile}`, import.meta.url), result);
console.log(JSON.stringify({ triangles: simplified.length / 3, vertices: count, error,
  originalMB: source.length / 1e6, outputMB: result.length / 1e6 }, null, 2));
