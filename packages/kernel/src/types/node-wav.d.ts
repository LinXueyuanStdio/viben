declare module "node-wav" {
  function encode(
    channelData: Float32Array[],
    opts: { sampleRate: number; float?: boolean; bitDepth?: number },
  ): ArrayBuffer;
  function decode(
    buffer: ArrayBuffer | Buffer,
  ): { sampleRate: number; channelData: Float32Array[] };
  export { encode, decode };
}
