/**
 * Redesign: SettingsScreen в стиле MAX.
 * Список разделов с иконками (как в MAX Настройки).
 * Показывается в List Panel (360px).
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ChevronRight, Shield, Monitor, Palette, Globe, Keyboard,
  HelpCircle, Info, LogOut, Link2, Lock, Bell, Eye,
  Check, X, Camera,
} from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { toast } from '@components/ui/Toast';
import { confirm } from '@components/ui/ConfirmDialog';
import { McpIntegrationCard } from '@components/settings/McpIntegrationCard';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { disconnectWS, updateProfile, uploadAvatar, changePassword } from '@/api/client';
import { t, setLocale, getLocale } from '@/i18n';
import type { Locale } from '@/i18n';
import { isDesktopRuntime } from '@/utils/desktopMcp';

// ==================== Вспомогательные ====================

const THEME_ORDER = ['dark', 'light', 'system'] as const;
const THEME_LABELS: Record<(typeof THEME_ORDER)[number], string> = {
  dark: 'Тёмная',
  light: 'Светлая',
  system: 'Системная',
};
const LOCALE_LABELS: Record<Locale, string> = { ru: 'Русский', en: 'English', kz: 'Қазақша' };

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  /** Текст справа (например, текущая тема или язык) */
  rightLabel?: string;
  /** Toggle-режим: показывает переключатель вместо шеврона */
  toggle?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 34,
        height: 20,
        borderRadius: 10,
        background: on ? '#5B5FC7' : 'rgba(255,255,255,0.15)',
        position: 'relative',
        transition: 'background 150ms ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 150ms ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </span>
  );
}

function MenuItem({ icon, label, rightLabel, toggle, isActive, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      role={toggle ? 'switch' : undefined}
      aria-checked={toggle ? !!isActive : undefined}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
      style={{
        background: 'transparent',
        color: 'rgba(255,255,255,0.88)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
      <span className="text-[15px] flex-1">{label}</span>
      {rightLabel !== undefined && (
        <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {rightLabel}
        </span>
      )}
      {toggle ? (
        <Toggle on={!!isActive} />
      ) : (
        <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.2)' }} />
      )}
    </button>
  );
}

function Separator() {
  return <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 16px' }} />;
}

// ==================== Profile Editor (inline) ====================

function ProfileEditor() {
  const user = useAuthStore((s) => s.user);
  const loginAction = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.display_name || '');
  const [nameSaving, setNameSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  const handleSaveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === user?.display_name) { setEditingName(false); return; }
    setNameSaving(true);
    try {
      const updated = await updateProfile({ display_name: trimmed });
      loginAction(token || '', {
        id: updated.id, email: updated.email,
        display_name: updated.display_name,
        avatar_url: updated.avatar_url ?? undefined,
      });
      setEditingName(false);
      toast.success('Имя обновлено');
    } catch (err) {
      console.error('[settings] save name failed', err);
      toast.error(err instanceof Error ? err.message : 'Не удалось обновить имя');
    } finally {
      setNameSaving(false);
    }
  }, [nameValue, user?.display_name, token, loginAction]);

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Максимальный размер аватара — 5 МБ');
      return;
    }
    try {
      const result = await uploadAvatar(file);
      if (user) {
        loginAction(token || '', { ...user, avatar_url: result.avatar_url });
      }
      toast.success('Аватар обновлён');
    } catch (err) {
      console.error('[settings] avatar upload failed', err);
      toast.error(err instanceof Error ? err.message : 'Не удалось загрузить аватар');
    }
  }, [user, token, loginAction]);

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Заполните оба поля');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Пароль должен быть не короче 8 символов');
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setShowPassword(false);
      setPasswordMsg('');
      toast.success('Пароль изменён');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setPasswordMsg(msg);
      toast.error(msg);
    }
  }, [currentPassword, newPassword]);

  return (
    <div className="px-4 py-4">
      {/* Профиль — аватар + имя + email */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar size={56} name={user?.display_name || ''} src={user?.avatar_url} />
          <label
            className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: '#5B5FC7' }}
          >
            <Camera size={12} color="white" />
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="bg-transparent text-[17px] font-semibold text-white outline-none border-b"
                style={{ borderColor: '#5B5FC7' }}
                disabled={nameSaving}
              />
              <button onClick={handleSaveName} disabled={nameSaving}>
                <Check size={18} color="#5B5FC7" />
              </button>
              <button onClick={() => { setEditingName(false); setNameValue(user?.display_name || ''); }}>
                <X size={18} color="rgba(255,255,255,0.4)" />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingName(true)} className="text-left">
              <span className="text-[17px] font-semibold text-white block">{user?.display_name}</span>
              <span className="text-[13px] block" style={{ color: 'rgba(255,255,255,0.45)' }}>{user?.email}</span>
            </button>
          )}
        </div>
        <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />
      </div>

      {/* Пригласить друзей */}
      <button className="flex items-center gap-2 mt-4 text-left" style={{ color: '#5B5FC7' }}>
        <Link2 size={16} />
        <span className="text-[14px] font-medium">Пригласить друзей</span>
      </button>

      {/* Смена пароля (скрытая секция) */}
      {showPassword ? (
        <div className="mt-4 p-3 rounded-xl" style={{ background: '#282840' }}>
          <div className="flex flex-col gap-2">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Текущий пароль"
              className="bg-transparent text-[14px] text-white outline-none px-3 py-2 rounded-lg"
              style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Новый пароль"
              className="bg-transparent text-[14px] text-white outline-none px-3 py-2 rounded-lg"
              style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <div className="flex gap-2">
              <button onClick={handleChangePassword} className="text-[13px] font-medium px-3 py-1.5 rounded-lg" style={{ background: '#5B5FC7', color: '#fff' }}>
                Сохранить
              </button>
              <button onClick={() => setShowPassword(false)} className="text-[13px] px-3 py-1.5 rounded-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Отмена
              </button>
            </div>
            {passwordMsg && <span className="text-[12px]" style={{ color: passwordMsg === 'Пароль изменён' ? '#30D158' : '#FF453A' }}>{passwordMsg}</span>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ==================== Main Settings Screen ====================

export function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);
  const showDesktopMcp = isDesktopRuntime();

  const theme = useSettingsStore((s) => s.theme);
  const notificationsEnabled = useSettingsStore((s) => s.notifications_enabled);
  const readReceipts = useSettingsStore((s) => s.read_receipts);
  const appLock = useSettingsStore((s) => s.app_lock);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const loaded = useSettingsStore((s) => s.loaded);
  const [currentLocale, setCurrentLocaleState] = useState<Locale>(getLocale());

  useEffect(() => { if (!loaded) fetchSettings(); }, [loaded, fetchSettings]);

  const cycleTheme = useCallback(() => {
    const idx = THEME_ORDER.indexOf(theme as typeof THEME_ORDER[number]);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    updateSetting('theme', next);
  }, [theme, updateSetting]);

  const cycleLocale = useCallback(() => {
    const order: Locale[] = ['ru', 'en', 'kz'];
    const idx = order.indexOf(currentLocale);
    const next = order[(idx + 1) % order.length];
    setLocale(next);
    setCurrentLocaleState(next);
  }, [currentLocale]);

  const handleLogout = useCallback(async () => {
    const ok = await confirm({
      title: 'Выйти из профиля?',
      description: 'Придётся войти заново с email и паролем. Секретные сессии будут закрыты.',
      confirmLabel: 'Выйти',
      danger: true,
    });
    if (!ok) return;
    disconnectWS();
    logout();
  }, [logout]);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#1e1e2e' }}>
      {/* Заголовок */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 className="text-[22px] font-bold text-white">{t('nav.settings')}</h1>
      </div>

      {/* Профиль */}
      <ProfileEditor />

      <Separator />

      {/* Разделы настроек — как MAX */}
      <div className="flex-1">
        <MenuItem
          icon={<Shield size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          label="Блокировка приложения"
          toggle
          isActive={appLock}
          onClick={() => updateSetting('app_lock', !appLock)}
        />
        <MenuItem
          icon={<Bell size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          label={t('settings.notifications')}
          toggle
          isActive={notificationsEnabled}
          onClick={() => updateSetting('notifications_enabled', !notificationsEnabled)}
        />
        <MenuItem
          icon={<Eye size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          label="Отчёты о прочтении"
          toggle
          isActive={readReceipts}
          onClick={() => updateSetting('read_receipts', !readReceipts)}
        />
        <MenuItem
          icon={<Monitor size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          label="Устройства"
          onClick={() => toast.info('Управление устройствами скоро будет доступно')}
        />

        <Separator />

        <MenuItem
          icon={<Palette size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          label="Оформление"
          rightLabel={THEME_LABELS[theme as (typeof THEME_ORDER)[number]] ?? 'Тёмная'}
          onClick={cycleTheme}
        />
        <MenuItem
          icon={<Globe size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          label="Язык"
          rightLabel={LOCALE_LABELS[currentLocale]}
          onClick={cycleLocale}
        />
        <MenuItem
          icon={<Keyboard size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          label="Сочетания клавиш"
          onClick={() =>
            toast.info('Cmd/Ctrl+K — поиск · Esc — закрыть чат', 5000)
          }
        />

        <Separator />

        {showDesktopMcp && (
          <>
            <McpIntegrationCard />
            <Separator />
          </>
        )}

        <MenuItem
          icon={<Lock size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          label={t('settings.encryption')}
          rightLabel="Signal"
          onClick={() =>
            toast.info('E2E-шифрование Signal (X3DH + Double Ratchet) активно для секретных чатов')
          }
        />
        <MenuItem
          icon={<HelpCircle size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          label="Помощь"
          onClick={() => {
            window.open('https://docs.sonchat.uk/help', '_blank', 'noopener');
          }}
        />
        <MenuItem
          icon={<Info size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          label="О приложении"
          rightLabel={`v${import.meta.env.VITE_APP_VERSION ?? '1.0'}`}
          onClick={() =>
            toast.info('sOn Messenger — защищённый мессенджер с E2E шифрованием', 4000)
          }
        />
      </div>

      {/* Кнопка выхода — внизу */}
      <div className="px-4 py-4 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[15px] font-medium transition-colors"
          style={{ background: 'rgba(255,69,58,0.1)', color: '#FF453A' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,69,58,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,69,58,0.1)'; }}
        >
          <LogOut size={18} />
          Выйти из профиля
        </button>
      </div>
    </div>
  );
}
