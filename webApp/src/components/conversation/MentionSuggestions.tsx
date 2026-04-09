/**
 * P2.6: Dropdown автокомплита для @mentions.
 * Показывается над InputBar при вводе @, подгружает участников чата.
 */

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { searchChatMembers } from '@/api/client';
import { Avatar } from '@components/ui/Avatar';

interface MentionSuggestionsProps {
  chatId: string;
  query: string;
  onSelect: (user: { id: string; display_name: string }) => void;
  onClose: () => void;
}

interface MemberItem {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export const MentionSuggestions = memo(function MentionSuggestions({
  chatId,
  query,
  onSelect,
  onClose,
}: MentionSuggestionsProps) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchMembers = useCallback(async (q: string) => {
    if (q.length < 1) { setMembers([]); return; }
    setLoading(true);
    try {
      const data = await searchChatMembers(chatId, q);
      setMembers(data.members);
      setSelectedIdx(0);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    const timer = setTimeout(() => fetchMembers(query), 200);
    return () => clearTimeout(timer);
  }, [query, fetchMembers]);

  // Клавиатурная навигация
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (members.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % members.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + members.length) % members.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(members[selectedIdx]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [members, selectedIdx, onSelect, onClose]);

  if (members.length === 0 && !loading) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden shadow-lg z-50"
      style={{ background: '#2C2C2E', border: '0.5px solid rgba(255,255,255,0.1)' }}
    >
      {loading && members.length === 0 ? (
        <div className="px-4 py-3 text-[13px] text-white/40">Поиск...</div>
      ) : (
        members.map((member, idx) => (
          <button
            key={member.id}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
            style={{
              background: idx === selectedIdx ? 'rgba(255,255,255,0.08)' : 'transparent',
            }}
            onMouseEnter={() => setSelectedIdx(idx)}
            onClick={() => onSelect(member)}
          >
            <Avatar
              src={member.avatar_url ?? undefined}
              name={member.display_name}
              size={28}
            />
            <span className="text-[15px] text-white">{member.display_name}</span>
          </button>
        ))
      )}
    </div>
  );
});
