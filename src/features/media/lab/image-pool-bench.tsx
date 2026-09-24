import { useRef, useState } from 'react';
import { Button } from 'zmp-ui';

import {
  type BenchConfig,
  type BenchResult,
  formatBenchTsv,
  summarizeBench,
} from '@/features/media/lab/pool-bench-summary';
import { BENCH_CONFIGS, runPoolBench } from '@/features/media/lab/run-pool-bench';
import { canOptimizeImages } from '@/features/media/optimize-image';

// Survives the page reload that WKWebView does when it runs out of memory.
const STAGE_KEY = 'medialab.poolStage';
// Lets the previous run's memory be released before the next one starts.
const PAUSE_BETWEEN_RUNS_MS = 1500;
const MB = 1024 * 1024;

const TABLE_CONFIGS = BENCH_CONFIGS.filter((config) => config.key !== 'all');
const ALL_AT_ONCE = BENCH_CONFIGS.find((config) => config.key === 'all') as BenchConfig;

function writeStage(value: string | null) {
  try {
    if (value) {
      sessionStorage.setItem(STAGE_KEY, value);
    } else {
      sessionStorage.removeItem(STAGE_KEY);
    }
  } catch {
    // Private mode: the crash marker is a convenience, the benchmark still runs.
  }
}

function readStage() {
  try {
    return sessionStorage.getItem(STAGE_KEY);
  } catch {
    return null;
  }
}

function describeDevice() {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return [
    `cores ${navigator.hardwareConcurrency ?? '?'}`,
    `deviceMemory ${memory ?? 'không có'}`,
    `OffscreenCanvas ${canOptimizeImages ? 'có' : 'KHÔNG'}`,
  ].join(' · ');
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ImagePoolBench() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<BenchResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [crashedStage] = useState(readStage);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(event.target.files ?? []));
    setResults([]);
  };

  const runConfigs = async (configs: BenchConfig[]) => {
    for (const config of configs) {
      setRunning(config.label);
      writeStage(`${config.label} · ${files.length} ảnh · ${new Date().toLocaleTimeString()}`);

      const result = await runPoolBench(files, config);
      setResults((current) => [...current, result]);

      writeStage(null);
      await wait(PAUSE_BETWEEN_RUNS_MS);
    }
    setRunning(null);
  };

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  const isBusy = running !== null;
  const lastFailures = results[results.length - 1]?.jobs.filter((job) => !job.ok) ?? [];

  return (
    <section className="marketplace-card mt-3 p-4">
      <p className="field-heading m-0">Worker pool: N worker × M ảnh (R3)</p>
      <p className="m-0 mt-1 text-sm text-slate-500">{describeDevice()}</p>
      <p className="m-0 mt-1 text-sm text-slate-500">
        Chọn ~10 ảnh thật khác nhau, có cả ảnh 24 MP. RAM trong bảng là ước tính (rộng × cao × 4);
        RAM thật đo bằng Xcode Instruments hoặc chrome://inspect trong lúc chạy.
      </p>

      {crashedStage && (
        <p className="m-0 mt-2 text-sm font-semibold text-red-600">
          Lần trước trang bị tải lại khi đang chạy: {crashedStage}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="small" disabled={isBusy} onClick={() => inputRef.current?.click()}>
          {files.length ? `${files.length} ảnh · ${(totalBytes / MB).toFixed(1)} MB` : 'Chọn ảnh'}
        </Button>
        <Button
          size="small"
          disabled={isBusy || !files.length || !canOptimizeImages}
          onClick={() => void runConfigs(TABLE_CONFIGS)}
        >
          Chạy cả bảng
        </Button>
        <Button
          size="small"
          variant="secondary"
          disabled={isBusy || !files.length || !canOptimizeImages}
          onClick={() => void runConfigs([ALL_AT_ONCE])}
        >
          Tất cả cùng lúc (có thể crash)
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="absolute h-0 w-0 opacity-0"
        onChange={handlePick}
      />

      {running && <p className="m-0 mt-2 text-sm">Đang chạy {running}…</p>}

      {results.length > 0 && <BenchTable results={results} />}

      {lastFailures.map((job) => (
        <p key={job.name} className="m-0 mt-1 break-all text-xs text-red-600">
          {job.name}: {job.step ?? 'worker crash'} · {job.error}
        </p>
      ))}

      {results.length > 0 && (
        <textarea
          readOnly
          className="mt-3 h-28 w-full rounded border border-slate-200 p-2 font-mono text-xs"
          value={formatBenchTsv(results)}
        />
      )}
    </section>
  );
}

function BenchTable({ results }: { results: BenchResult[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="pr-2">Cấu hình</th>
            <th className="pr-2">Tổng ms</th>
            <th className="pr-2">ms/ảnh</th>
            <th className="pr-2">decode/draw/encode</th>
            <th className="pr-2">draw %</th>
            <th className="pr-2">Frame dài nhất</th>
            <th className="pr-2">Đồng thời</th>
            <th className="pr-2">RAM ước tính</th>
            <th>Lỗi</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => {
            const summary = summarizeBench(result);
            return (
              <tr key={`${result.config.key}-${result.totalMs}`}>
                <td className="whitespace-nowrap pr-2">{result.config.label}</td>
                <td className="pr-2">{Math.round(result.totalMs)}</td>
                <td className="pr-2">{Math.round(summary.msPerImage)}</td>
                <td className="whitespace-nowrap pr-2">
                  {Math.round(summary.medianDecodeMs)}/{Math.round(summary.medianDrawMs)}/
                  {Math.round(summary.medianEncodeMs)}
                </td>
                <td className="pr-2">{Math.round(summary.drawShare * 100)}</td>
                <td className="pr-2">{Math.round(result.longestFrameMs)}</td>
                <td className="pr-2">{result.peakInFlight}</td>
                <td className="whitespace-nowrap pr-2">
                  {(result.peakEstimatedBytes / MB).toFixed(0)} MB
                </td>
                <td>
                  {summary.failed}
                  {result.workerCrashes > 0 && ` · ${result.workerCrashes} crash`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
