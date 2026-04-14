/**
 * EmptyState — универсальный плейсхолдер для пустых экранов/списков.
 * Использование: <EmptyState icon={<MessageSquare />} title="Нет чатов" description="..." />
 */

import { memo, type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        padding: compact ? '24px 16px' : '48px 24px',
        gap: compact ? 8 : 12,
        color: 'rgba(255,255,255,0.6)',
        width: '100%',
        height: compact ? undefined : '100%',
      }}
      role="status"
    >
      {icon && (
        <div
          style={{
            width: compact ? 40 : 64,
            height: compact ? 40 : 64,
            borderRadius: '50%',
            background: 'rgba(91,95,199,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#5B5FC7',
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: compact ? 14 : 16,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: compact ? 12 : 13,
            color: 'rgba(255,255,255,0.45)',
            maxWidth: 320,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
});
