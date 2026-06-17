/**
 * Phase 40 — /testing/[runId] Route
 * Persistent test run details: annotated screenshots, per-scenario breakdown, perf metrics
 * @author abhiswami2121@gmail.com
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ScenarioDetail {
  name: string;
  result: 'pass' | 'fail' | 'error' | 'skipped';
  durationMs: number;
  error?: string;
  screenshotIds: string[];
  assertions: { description: string; passed: boolean; expected: string; actual: string }[];
}

interface RunDetail {
  runId: string;
  playbookName: string;
  status: string;
  targetUrl: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  estimatedCost: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    skipped: number;
    passRate: number;
  };
  scenarios: ScenarioDetail[];
  screenshots: { id: string; path: string; scenarioName: string }[];
  errors: { scenario: string; type: string; message: string }[];
}

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRunDetail();
  }, [runId]);

  async function fetchRunDetail() {
    try {
      const res = await fetch(`/api/testing/runs/${runId}`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      setRun(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
        <div className="p-8 bg-red-900/30 border border-red-500 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Error Loading Run</h2>
          <p className="text-red-300">{error || 'Run not found'}</p>
          <Link href="/testing" className="text-cyan-400 hover:underline mt-4 inline-block">
            ← Back to Testing
          </Link>
        </div>
      </div>
    );
  }

  const statusColor = run.status === 'completed' ? 'text-green-400' :
    run.status === 'failed' ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/testing" className="text-cyan-400 hover:underline">
          ← Testing Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {run.summary.passRate >= 90 ? '✅' : run.summary.passRate >= 70 ? '⚠️' : '❌'} {run.playbookName}
        </h1>
        <div className="flex gap-4 text-sm text-gray-400">
          <span>Run ID: <code className="text-cyan-400">{run.runId}</code></span>
          <span>Target: <code className="text-cyan-400">{run.targetUrl}</code></span>
          <span className={statusColor}>{run.status}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-cyan-400">{run.summary.passRate}%</div>
          <div className="text-gray-400 text-sm">Pass Rate</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-400">{run.summary.passed}</div>
          <div className="text-gray-400 text-sm">Passed</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-red-400">{run.summary.failed + run.summary.errors}</div>
          <div className="text-gray-400 text-sm">Failed/Errors</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-gray-300">{(run.durationMs / 1000).toFixed(1)}s</div>
          <div className="text-gray-400 text-sm">Duration</div>
        </div>
      </div>

      {/* Cost */}
      <div className="mb-8 p-3 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-400">
        <span className="font-mono text-cyan-400">${run.estimatedCost.toFixed(4)}</span> LLM tokens |
        Started: {new Date(run.startedAt).toLocaleString()} |
        Completed: {run.completedAt ? new Date(run.completedAt).toLocaleString() : 'N/A'}
      </div>

      {/* Scenarios Breakdown */}
      <h2 className="text-xl font-bold mb-4">📋 Scenario Breakdown</h2>
      <div className="space-y-4 mb-8">
        {run.scenarios.map((scenario, idx) => (
          <div
            key={idx}
            className={`border rounded-lg p-4 ${
              scenario.result === 'pass' ? 'border-green-800 bg-green-900/10' :
              scenario.result === 'fail' ? 'border-red-800 bg-red-900/10' :
              scenario.result === 'error' ? 'border-red-500 bg-red-900/20' :
              'border-gray-800 bg-gray-900/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold">
                {scenario.result === 'pass' ? '✅' :
                 scenario.result === 'fail' ? '❌' :
                 scenario.result === 'error' ? '💥' : '⏭️'} {scenario.name}
              </h3>
              <span className="text-sm text-gray-400">
                {(scenario.durationMs / 1000).toFixed(1)}s
              </span>
            </div>

            {scenario.error && (
              <div className="mb-2 p-3 bg-red-950/50 border border-red-800 rounded text-sm text-red-300 font-mono">
                {scenario.error}
              </div>
            )}

            {scenario.assertions.length > 0 && (
              <div className="space-y-1 mt-2">
                {scenario.assertions.map((a, aIdx) => (
                  <div key={aIdx} className="flex items-center gap-2 text-sm">
                    <span>{a.passed ? '✅' : '❌'}</span>
                    <span className="text-gray-300">{a.description}</span>
                    {!a.passed && (
                      <span className="text-red-400 text-xs">
                        expected: &ldquo;{a.expected}&rdquo; got: &ldquo;{a.actual}&rdquo;
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Errors Section */}
      {run.errors.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-red-400">💥 Errors</h2>
          <div className="space-y-2">
            {run.errors.map((err, idx) => (
              <div key={idx} className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
                <span className="font-mono text-xs bg-red-800/50 px-2 py-0.5 rounded mr-2">
                  {err.type}
                </span>
                <span className="text-red-300">{err.scenario}: {err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screenshots */}
      {run.screenshots.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">📸 Screenshots ({run.screenshots.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {run.screenshots.map((shot) => (
              <div key={shot.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <div className="aspect-video bg-gray-800 flex items-center justify-center">
                  <span className="text-gray-600 text-sm">Screenshot: {shot.scenarioName}</span>
                </div>
                <div className="p-2 text-xs text-gray-500 font-mono truncate">
                  {shot.path}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 mt-8 pt-8 border-t border-gray-800">
        <button
          onClick={() => {/* re-run */}}
          className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-sm font-medium transition-colors"
        >
          🔄 Re-run Test
        </button>
        <Link
          href="/testing"
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium transition-colors"
        >
          ← Back to Gallery
        </Link>
      </div>
    </div>
  );
}
