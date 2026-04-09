/**
 * P2.9: Карточка опроса в MessageBubble.
 * Показывает вопрос, варианты с прогресс-барами, кнопку голосования.
 */

import { memo, useState, useCallback } from 'react';
import { BarChart3, Check } from 'lucide-react';

interface PollOption {
  id: string;
  text: string;
  votes: number;
  voted: boolean;
}

interface PollCardProps {
  pollId: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  isMultipleChoice: boolean;
  isExpired: boolean;
  onVote: (pollId: string, optionId: string) => void;
}

export const PollCard = memo(function PollCard({
  pollId,
  question,
  options,
  totalVotes,
  isMultipleChoice,
  isExpired,
  onVote,
}: PollCardProps) {
  const [voting, setVoting] = useState<string | null>(null);
  const hasVoted = options.some((o) => o.voted);

  const handleVote = useCallback(async (optionId: string) => {
    if (isExpired) return;
    setVoting(optionId);
    try {
      onVote(pollId, optionId);
    } finally {
      setVoting(null);
    }
  }, [pollId, isExpired, onVote]);

  return (
    <div className="w-full max-w-[280px]">
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 size={14} className="text-white/50" />
        <span className="text-[13px] font-semibold text-white">{question}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const showResults = hasVoted || isExpired;

          return (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.id)}
              disabled={isExpired || voting !== null}
              className="relative w-full text-left rounded-lg overflow-hidden transition-opacity"
              style={{
                background: 'rgba(255,255,255,0.08)',
                padding: '8px 12px',
                opacity: voting === opt.id ? 0.6 : 1,
              }}
            >
              {showResults && (
                <div
                  className="absolute inset-0 rounded-lg transition-all"
                  style={{
                    background: opt.voted ? 'rgba(0,122,255,0.3)' : 'rgba(255,255,255,0.05)',
                    width: `${pct}%`,
                  }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span className="text-[14px] text-white">{opt.text}</span>
                <span className="text-[12px] text-white/60 ml-2 flex items-center gap-1">
                  {opt.voted && <Check size={12} className="text-blue-400" />}
                  {showResults && `${pct}%`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-white/40 mt-2">
        {totalVotes} голос{totalVotes === 1 ? '' : totalVotes < 5 ? 'а' : 'ов'}
        {isMultipleChoice && ' · несколько вариантов'}
        {isExpired && ' · завершён'}
      </p>
    </div>
  );
});
