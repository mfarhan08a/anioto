import { describe, expect, it } from 'vitest';
import { elapsedView, progressView } from '../src/progress';

describe('progressView', () => {
  it('keeps overlapping capture and recognition animated with a live elapsed timer', () => {
    const job = { id: 'progressive', stage: 'listening and recognizing', startedAt: 1000, stageStartedAt: 1000, message: 'Checking the 3-second sample while listening continues.' };
    expect(progressView(job, 5000)).toMatchObject({ active: true, step: 0, determinate: false, detail: job.message });
    expect(elapsedView(job, 5000).activeText).toBe('Total time: 0:04 · This stage: 0:04');
  });
  it('advances capture progress from its persisted stage start time', () => {
    const startedAt = 1_000_000;
    const job = { id: 'capture', stage: 'capturing', stageStartedAt: startedAt, message: 'Recording.' };

    expect(progressView(job, startedAt).percent).toBe(0);
    expect(progressView(job, startedAt + 7_500).percent).toBe(50);
    expect(progressView(job, startedAt + 30_000).percent).toBe(95);
    // A reopened popup computes from the same persisted timestamp.
    expect(progressView(job, startedAt + 10_000).percent).toBeCloseTo(66.67, 1);
  });

  it('uses the requested 12-second capture duration for progress and capture instructions', () => {
    const startedAt = 1_000_000;
    const job = { id: 'local', stage: 'capturing', captureSeconds: 12, stageStartedAt: startedAt, message: 'Recording.' } as Parameters<typeof progressView>[0];
    const halfway = progressView(job, startedAt + 6_000);
    expect(halfway.percent).toBe(50);
    expect(halfway.captureSeconds).toBe(12);
    expect(halfway.detail).toContain('12-second sample');
  });

  it('falls back to a 15-second capture for unsupported duration values', () => {
    const unknownDuration = { id: 'unknown', stage: 'capturing', captureSeconds: 20, stageStartedAt: 1_000, message: 'Recording.' } as Parameters<typeof progressView>[0];
    const view = progressView(unknownDuration, 7_000);
    expect(view.percent).toBe(40);
    expect(view.captureSeconds).toBe(15);
    expect(view.detail).toContain('15-second sample');
  });

  it('keeps recognition and anime lookup indeterminate until each stage ends', () => {
    expect(progressView({ id: 'recognize', stage: 'recognizing', message: 'Matching audio.' }).determinate).toBe(false);
    expect(progressView({ id: 'lookup', stage: 'resolving anime', message: 'Searching.' }).determinate).toBe(false);
  });

  it('tracks total and stage elapsed time from persisted timestamps after popup reopen', () => {
    const job = {
      id: 'request', stage: 'resolving anime', startedAt: 10_000, stageStartedAt: 25_000,
      message: 'Searching.'
    };
    expect(elapsedView(job, 30_000).activeText).toBe('Total time: 0:20 · This stage: 0:05');
    // A reopened popup derives both clocks from the same persisted values.
    expect(elapsedView(job, 40_000).activeText).toBe('Total time: 0:30 · This stage: 0:15');
  });

  it('freezes elapsed total time at the persisted terminal timestamp', () => {
    const job = { id: 'request', stage: 'complete', startedAt: 10_000, finishedAt: 34_000, message: 'Done.' };
    expect(elapsedView(job, 99_000).terminalText).toBe('Total time: 0:24');
  });
});
