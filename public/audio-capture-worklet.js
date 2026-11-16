const BATCH_FRAMES = 4096;

class AnimeSongCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.maxFrames = Math.max(0, Math.floor(options.processorOptions?.maxFrames ?? 0));
    this.capturedFrames = 0;
    this.batchFrames = 0;
    this.leftBatch = new Float32Array(BATCH_FRAMES);
    this.rightBatch = new Float32Array(BATCH_FRAMES);
    this.finished = false;
    this.port.onmessage = (event) => {
      if (event.data?.type === 'stop') this.finish();
    };
  }

  process(inputs, outputs) {
    for (const output of outputs) {
      for (const channel of output) channel.fill(0);
    }
    if (this.finished) return false;

    try {
      const input = inputs[0];
      const left = input?.[0];
      if (!left) return true;
      const right = input[1] ?? left;
      const count = Math.min(left.length, right.length, this.maxFrames - this.capturedFrames);
      for (let index = 0; index < count; index++) {
        this.leftBatch[this.batchFrames] = left[index];
        this.rightBatch[this.batchFrames] = right[index];
        this.batchFrames++;
        this.capturedFrames++;
        if (this.batchFrames === BATCH_FRAMES) this.flushBatch();
      }
      if (this.capturedFrames >= this.maxFrames) this.finish();
      return !this.finished;
    } catch (error) {
      this.port.postMessage({ type: 'error', message: String(error) });
      this.finish();
      return false;
    }
  }

  flushBatch() {
    if (!this.batchFrames) return;
    // Slice so each message owns its arrays; the backing batch is immediately reused.
    const left = this.leftBatch.slice(0, this.batchFrames);
    const right = this.rightBatch.slice(0, this.batchFrames);
    this.port.postMessage({ type: 'data', left, right });
    this.batchFrames = 0;
  }

  finish() {
    if (this.finished) return;
    this.flushBatch();
    this.finished = true;
    this.port.postMessage({ type: 'done' });
  }
}

registerProcessor('anime-song-capture', AnimeSongCaptureProcessor);
