import type { Job } from './contracts';

export const ACTIVE_STAGES = new Set([
  'capturing', 'submitting', 'recognizing', 'awaiting recognition',
  'resolving', 'resolving anime', 'listening and recognizing'
]);

export interface ProgressView {
  active: boolean;
  step: number;
  label: string;
  detail: string;
  determinate: boolean;
  percent?: number;
  captureSeconds?: 12 | 15;
  captureElapsedSeconds?: number;
}

export interface ElapsedView {
  activeText?: string;
  terminalText?: string;
}

const stages = [
  { label: 'Recording tab audio' },
  { label: 'Recognizing the song', detail: 'Checking the sample with the selected recognition provider.' },
  { label: 'Looking up anime', detail: 'Searching documented anime song associations.' },
];

export function progressView(job: Job, now = Date.now()): ProgressView {
  if (!ACTIVE_STAGES.has(job.stage)) {
    return { active: false, step: -1, label: '', detail: '', determinate: false };
  }
  if (job.stage === 'listening and recognizing') {
    return { active: true, step: 0, label: 'Listening and recognizing', detail: job.message, determinate: false };
  }
  const step = ['capturing'].includes(job.stage) ? 0
    : ['submitting', 'recognizing', 'awaiting recognition'].includes(job.stage) ? 1 : 2;
  if (step === 0) {
    const requestedSeconds = (job as Job & { captureSeconds?: number }).captureSeconds;
    const captureSeconds = requestedSeconds === 12 ? 12 : 15;
    const startedAt = typeof job.stageStartedAt === 'number' ? job.stageStartedAt : now;
    const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
    // Stop short of 100% until the
    // capture stage actually ends so this never promises completion early.
    const percent = Math.min(95, Math.max(0, (elapsedSeconds / captureSeconds) * 100));
    return {
      active: true,
      step,
      label: stages[step]!.label,
      detail: `Capturing a ${captureSeconds}-second sample from the selected tab.`,
      determinate: true,
      percent,
      captureSeconds,
      captureElapsedSeconds: elapsedSeconds,
    };
  }
  return { active: true, step, label: stages[step]!.label, detail: job.message || stages[step]!.detail || '', determinate: false };
}

export function elapsedView(job: Job, now = Date.now()): ElapsedView {
  const timedJob = job as Job & { startedAt?: number; finishedAt?: number };
  if (ACTIVE_STAGES.has(job.stage) && typeof timedJob.startedAt === 'number') {
    const total = formatElapsed(now - timedJob.startedAt);
    const stageStart = typeof job.stageStartedAt === 'number' ? job.stageStartedAt : timedJob.startedAt;
    const stage = formatElapsed(now - stageStart);
    return { activeText: `Total time: ${total} · This stage: ${stage}` };
  }
  if (!ACTIVE_STAGES.has(job.stage) && typeof timedJob.startedAt === 'number' && typeof timedJob.finishedAt === 'number') {
    return { terminalText: `Total time: ${formatElapsed(timedJob.finishedAt - timedJob.startedAt)}` };
  }
  return {};
}

export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}:${seconds}`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${seconds}`;
}
