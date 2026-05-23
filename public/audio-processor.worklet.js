/**
 * PCM audio processor for Gemini Live API.
 *
 * Loaded via AudioWorkletNode in a separate worker context.
 * Converts Float32 microphone samples to Int16 PCM and posts
 * each chunk to the main thread as a transferable ArrayBuffer.
 *
 * File must live in /public so the browser can load it as a worker script.
 */
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const channelData = input[0]; // Float32Array at AudioContext sample rate
    const int16 = new Int16Array(channelData.length);

    for (let i = 0; i < channelData.length; i++) {
      const clamped = Math.max(-1, Math.min(1, channelData[i]));
      int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    // Transfer ownership of the buffer to avoid a copy
    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
