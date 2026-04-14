/**
 * P2.1: Модал для создания и копирования invite link группового чата.
 * Показывает список существующих invite'ов и позволяет создать новый.
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { X, Copy, Link2, Check, Trash2, Loader2 } from 'lucide-react';
import { createInviteLink, getInvites, revokeInvite } from '@/api/client';

interface InviteLinkModalProps {
  chatId: string;
  chatName: string;
  onClose: () => void;
}

interface InviteItem {
  id: string;
  token: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
}

export const InviteLinkModal = memo(function InviteLinkModal({
  chatId,
  chatName,
  onClose,
}: InviteLinkModalProps) {
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      const data = await getInvites(chatId);
      setInvites(data.invites);
    } catch {
      // Не критично — модал просто покажет пустой список
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const inv = await createInviteLink(chatId);
      setInvites((prev) => [{ ...inv, uses_count: 0 }, ...prev]);
    } catch (err) {
      console.error('[InviteLinkModal] create failed', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite(chatId, inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      console.error('[InviteLinkModal] revoke failed', err);
    }
  };

  const handleCopy = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] mx-4 rounded-2xl overflow-hidden"
        style={{ background: '#2C2C2E' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-[17px] font-semibold text-white">
            Ссылки-приглашения
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Подзаголовок */}
        <p className="px-4 pt-3 text-[13px] text-white/50">
          Группа: {chatName}
        </p>

        {/* Создать новую */}
        <div className="px-4 py-3">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[15px] font-medium"
            style={{ background: '#5B5FC7', color: '#fff', opacity: creating ? 0.6 : 1 }}
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
            Создать ссылку
          </button>
        </div>

        {/* Список */}
        <div className="px-4 pb-4 max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-white/30" />
            </div>
          ) : invites.length === 0 ? (
            <p className="text-center text-[13px] text-white/30 py-4">
              Нет активных приглашений
            </p>
          ) : (
            invites.map((inv) => {
              const url = `${window.location.origin}/invite/${inv.token}`;
              const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
              const isExhausted = inv.max_uses && inv.uses_count >= inv.max_uses;
              const isActive = !isExpired && !isExhausted;

              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white/80 truncate font-mono">
                      {url}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {inv.uses_count} использ.
                      {inv.max_uses ? ` / ${inv.max_uses}` : ''}
                      {!isActive && (
                        <span className="ml-1 text-red-400">
                          {isExpired ? '(истекла)' : '(исчерпана)'}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(inv.token)}
                    className="p-1.5 rounded-lg hover:bg-white/10"
                    title="Копировать"
                  >
                    {copied === inv.token
                      ? <Check size={16} className="text-green-400" />
                      : <Copy size={16} className="text-white/50" />
                    }
                  </button>
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    className="p-1.5 rounded-lg hover:bg-white/10"
                    title="Отозвать"
                  >
                    <Trash2 size={16} className="text-red-400/60" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});
