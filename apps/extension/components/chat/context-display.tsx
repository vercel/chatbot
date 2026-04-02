import type { JSX } from 'react';

export function ContextDisplay({
  usedTokens,
  maxTokens,
}: {
  usedTokens: number;
  maxTokens: number;
}): JSX.Element {
  const safeMax = Math.max(1, maxTokens);
  const ratio = Math.min(1, Math.max(0, usedTokens / safeMax));
  const percent = Math.round(ratio * 100);

  const statusColor =
    percent > 85 ? '#dc2626' : percent > 65 ? '#d97706' : '#059669';

  return (
    <div
      title={`Context usage ${usedTokens}/${maxTokens} tokens`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 150,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#94a3b8',
        }}
      >
        <span>Context</span>
        <span>{percent}%</span>
      </div>
      <div
        style={{
          width: '100%',
          height: 8,
          borderRadius: 999,
          background: '#1e293b',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: statusColor,
            transition: 'width 180ms ease',
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        {usedTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
      </div>
    </div>
  );
}
