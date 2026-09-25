import { useRef, useState } from 'react';
import { Button } from 'zmp-ui';

import {
  type BenchConfig,
  type BenchResult,
  formatBenchTsv,
  summarizeBench,
} from '@/features/media/lab/pool-bench-summary';
import { ALL_AT_ONCE, BENCH_CONFIGS, runPoolBench } from '@/features/media/lab/run-pool-bench';
import { createStageBreadcrumb } from '@/features/media/lab/stage-breadcrumb';
import { MIB } from '@/features/media/media-limits';
import { canOptimizeImages } from '@/features/media/image/image-worker';

const breadcrumb = createStageBreadcrumb('medialab.poolStage');
// Lets the previous run's memory be released before the next one starts.
const PAUSE_BETWEEN_RUNS_MS = 1500;

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
  const [runError, setRunError] = useState<string | null>(null);
  const [crashedStage] = useState(breadcrumb.read);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(event.target.files ?? []));
    setResults([]);
    setRunError(null);
  };

  const runConfigs = async (configs: BenchConfig[]) => {
    try {
      for (const config of configs) {
        setRunning(config.label);
        breadcrumb.write(`${config.label} · ${files.length} ảnh`);
        const result = await runPoolBench(files, config);
        setResults((current) => [...current, result]);
        await wait(PAUSE_BETWEEN_RUNS_MS);
      }
    } catch (error) {
      // A file that cannot be read is an error, not a crash: say so instead of leaving the
      // breadcrumb behind for the next open to report as one.
      setRunError(error instanceof Error ? error.message : String(error));
    } finally {
      breadcrumb.clear();
      setRunning(null);
    }
  };

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  const isBusy = running !== null;
  const lastFailures = results[results.length - 1]?.jobs.filter((job) => !job.ok) ?? [];

  return (
    <section className="marketplace-card mt-3 p-4">
      <p className="field-heading m-0">Worker pool: N worker × M ảnh (R3)</p>
      <p className="m-0 mt-1 text-sm text-slate-500">{describeDevice()}</p>
      <p className="m-0 mt-1 text-sm text-slate-500">
        Chọn ~10 ảnh thật khác nhau, có cả ảnh 24 MP. RAM trong bảng là ước tính (ảnh giải nén rộng
        × cao × 4, cộng khung 1280); RAM thật đo bằng Xcode Instruments hoặc chrome://inspect trong
        lúc chạy.
      </p>

      {crashedStage && (
        <p className="m-0 mt-2 text-sm font-semibold text-red-600">
          Lần trước trang bị tải lại khi đang chạy: {crashedStage}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="small" disabled={isBusy} onClick={() => inputRef.current?.click()}>
          {files.length ? `${files.length} ảnh · ${(totalBytes / MIB).toFixed(1)} MB` : 'Chọn ảnh'}
        </Button>
        <Button
          size="small"
          disabled={isBusy || !files.length || !canOptimizeImages}
          onClick={() => void runConfigs(BENCH_CONFIGS)}
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
      {runError && (
        <p className="m-0 mt-2 text-sm text-red-600">Lỗi, không phải crash: {runError}</p>
      )}

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
                  {(result.peakEstimatedBytes / MIB).toFixed(0)} MB
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
