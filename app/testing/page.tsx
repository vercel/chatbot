/**
 * Phase 40 — /testing Route
 * Playbook gallery + one-click run + live SSE progress
 * @author abhiswami2121@gmail.com
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ===== Types =====

interface PlaybookCard {
  name: string;
  path: string;
  description: string;
}

interface TestRunResult {
  runId: string;
  playbookName: string;
  status: string;
  passRate: number;
  duration: string;
  timestamp: string;
}

export default function TestingPage() {
  const [playbooks, setPlaybooks] = useState<PlaybookCard[]>([]);
  const [recentRuns, setRecentRuns] = useState<TestRunResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<string | null>(null);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaybooks();
    fetchRecentRuns();
  }, []);

  async function fetchPlaybooks() {
    try {
      const res = await fetch('/api/testing/playbooks');
      const data = await res.json();
      setPlaybooks(data.playbooks || []);
    } catch {
      setPlaybooks([
        { name: 'chat-smoke-test', path: 'chat-smoke-test.md', description: 'Core smoke test for Neptune Chat' },
        { name: 'chat-discovery-workflow-test', path: 'chat-discovery-workflow-test.md', description: 'Chat → Discovery integration E2E' },
        { name: 'v2-smoke-test', path: 'v2-smoke-test.md', description: 'V2 coding agent smoke test' },
        { name: 'twenty-crm-smoke-test', path: 'twenty-crm-smoke-test.md', description: 'Twenty CRM core objects verification' },
        { name: 'portal-customer-flow', path: 'portal-customer-flow.md', description: 'Customer Portal E2E flow' },
        { name: 'cross-app-billing-flow', path: 'cross-app-billing-flow.md', description: 'Billing pages (read-only, Tier 3)' },
      ]);
    }
  }

  async function fetchRecentRuns() {
    try {
      const res = await fetch('/api/testing/runs?limit=10');
      const data = await res.json();
      setRecentRuns(data.runs || []);
    } catch {
      setRecentRuns([]);
    }
  }

  async function runPlaybook(playbookName: string) {
    setIsRunning(true);
    setCurrentRun(playbookName);
    setProgress({ percent: 0, message: 'Starting...' });
    setError(null);

    try {
      const res = await fetch('/api/testing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playbook: playbookName }),
      });

      if (!res.ok) throw new Error(`Run failed: ${res.status}`);

      const data = await res.json();
      setProgress({ percent: 100, message: 'Complete' });
      setCurrentRun(data.runId);

      // Refresh recent runs after completion
      fetchRecentRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  }

  async function runAllSmokeTests() {
    setIsRunning(true);
    setCurrentRun('ALL_SMOKE');
    setProgress({ percent: 0, message: 'Running all smoke tests...' });
    setError(null);

    try {
      const res = await fetch('/api/testing/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'smoke' }),
      });

      if (!res.ok) throw new Error(`Run failed: ${res.status}`);

      const data = await res.json();
      setProgress({ percent: 100, message: `${data.totalPlaybooks} playbooks complete` });
      fetchRecentRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  }

  const severityColors: Record<string, string> = {
    critical: 'bg-red-900/30 border-red-500 text-red-300',
    high: 'bg-orange-900/30 border-orange-500 text-orange-300',
    medium: 'bg-yellow-900/30 border-yellow-500 text-yellow-300',
    low: 'bg-green-900/30 border-green-500 text-green-300',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🧪 Testing Dashboard</h1>
        <p className="text-gray-400">
          Phase 40 — Authenticated User-Testing Agent. Run automated UI tests against real apps.
        </p>
      </div>

      {/* Actions Bar */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={runAllSmokeTests}
          disabled={isRunning}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
        >
          {isRunning ? '⏳ Running...' : '🚀 Run All Smoke Tests'}
        </button>
        <span className="text-sm text-gray-500 self-center">
          {isRunning ? `Running: ${currentRun}` : 'Select a playbook below to run individually'}
        </span>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="mb-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="animate-spin h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full" />
            <span className="text-cyan-400 font-medium">{progress.message}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-8 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-300">
          ❌ {error}
        </div>
      )}

      {/* Playbook Gallery */}
      <h2 className="text-xl font-bold mb-4">📋 Test Playbooks</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {playbooks.map((pb) => (
          <div
            key={pb.name}
            className="bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-cyan-700 transition-colors"
          >
            <h3 className="font-bold text-lg mb-2">{pb.name}</h3>
            <p className="text-gray-400 text-sm mb-4">{pb.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => runPlaybook(pb.name)}
                disabled={isRunning}
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 rounded text-sm font-medium transition-colors"
              >
                ▶ Run
              </button>
              <Link
                href={`/testing/${pb.name}`}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium transition-colors"
              >
                History
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Runs */}
      <h2 className="text-xl font-bold mb-4">📊 Recent Test Runs</h2>
      {recentRuns.length === 0 ? (
        <p className="text-gray-500">No test runs yet. Run a playbook to see results.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="py-3 px-4 text-gray-400 font-medium">Run ID</th>
                <th className="py-3 px-4 text-gray-400 font-medium">Playbook</th>
                <th className="py-3 px-4 text-gray-400 font-medium">Status</th>
                <th className="py-3 px-4 text-gray-400 font-medium">Pass Rate</th>
                <th className="py-3 px-4 text-gray-400 font-medium">Duration</th>
                <th className="py-3 px-4 text-gray-400 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={run.runId} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3 px-4 font-mono text-sm text-cyan-400">
                    <Link href={`/testing/${run.runId}`} className="hover:underline">
                      {run.runId.slice(0, 20)}...
                    </Link>
                  </td>
                  <td className="py-3 px-4">{run.playbookName}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      run.status === 'completed' ? 'bg-green-900/30 text-green-300' :
                      run.status === 'failed' ? 'bg-red-900/30 text-red-300' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={run.passRate >= 90 ? 'text-green-400' : run.passRate >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                      {run.passRate}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400">{run.duration}</td>
                  <td className="py-3 px-4 text-gray-500 text-sm">{run.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-600 text-sm">
        Phase 40 Testing Agent | Playwright v1.51 + agent-browser v0.28.0 | Cost: ~$0.02/smoke test
      </div>
    </div>
  );
}
