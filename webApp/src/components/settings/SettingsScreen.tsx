import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ChevronRight, User, Palette, Bell, Shield, HardDrive,
  Lock, Info, LogOut, Check, X, Camera, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { disconnectWS, updateProfile, uploadAvatar, changePassword } from '@/api/client';


// ==================== Вспомогательные компоненты ====================

interface SettingRow {
  icon: React.ReactNode;
  label: string;
  value?: string;
  color?: string;
  onClick?: () => void;
}

function SettingsRow({ icon, label, value, onClick }: SettingRow) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-[11px] text-left"
    >
      {icon}
      <span className="flex-1 text-[15px] text-white">{label}</span>
      {value && <span className="text-[14px]" style={{ color: '#ABABAF' }}>{value}</span>}
      <ChevronRight size={16} color="#636366" aria-hidden="true" />
    </button>
  );
}

function Divider() {
  return <div style={{ height: '0.5px', background: '#38383A', marginLeft: '52px' }} />;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="px-4 pt-5 pb-2 text-[12px] font-semibold uppercase" style={{ color: '#ABABAF' }}>
      {title}
    </p>
  );
}

// ==================== Маппинги для отображения ====================

const THEME_LABELS: Record<string, string> = {
  dark: 'Тёмная',
  light: 'Светлая',
  system: 'Системная',
};

const THEME_ORDER: Array<'dark' | 'light' | 'system'> = ['dark', 'light', 'system'];

const PREVIEW_LABELS: Record<string, string> = {
  always: 'Всегда',
  contacts: 'Контакты',
  never: 'Никогда',
};

const PREVIEW_ORDER: Array<'always' | 'contacts' | 'never'> = ['always', 'contacts', 'never'];

const ONLINE_LABELS: Record<string, string> = {
  everyone: 'Все',
  contacts: 'Контакты',
  nobody: 'Никто',
};

const ONLINE_ORDER: Array<'everyone' | 'contacts' | 'nobody'> = ['everyone', 'contacts', 'nobody'];

// ==================== Секция редактирования профиля ====================

function ProfileEditor() {
  const user = useAuthStore((s) => s.user);
  const loginAction = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);

  const displayName = user?.display_name || 'Пользователь';
  const email = user?.email || '';

  // Режимы редактирования
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(displayName);
  const [nameSaving, setNameSaving] = useState(false);

  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Сохранить имя
  const handleSaveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === displayName) {
      setEditingName(false);
      return;
    }
    setNameSaving(true);
    try {
      const updated = await updateProfile({ display_name: trimmed });
      if (token) {
        loginAction(token, {
          id: updated.id,
          email: updated.email,
          display_name: updated.display_name,
          avatar_url: updated.avatar_url ?? undefined,
        });
      }
      setEditingName(false);
    } catch (err) {
      console.error('Ошибка обновления имени:', err);
    } finally {
      setNameSaving(false);
    }
  }, [nameValue, displayName, token, loginAction]);

  // Загрузить аватар
  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const result = await uploadAvatar(file);
      if (token && user) {
        loginAction(token, {
          ...user,
          avatar_url: result.avatar_url,
        });
      }
    } catch (err) {
      console.error('Ошибка загрузки аватара:', err);
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [token, user, loginAction]);

  // Сменить пароль
  const handleChangePassword = useCallback(async () => {
    setPwdError('');
    setPwdSuccess('');
    if (!currentPwd || !newPwd) {
      setPwdError('Заполните оба поля');
      return;
    }
    if (newPwd.length < 6) {
      setPwdError('Минимум 6 символов');
      return;
    }
    setPwdSaving(true);
    try {
      await changePassword(currentPwd, newPwd);
      setPwdSuccess('Пароль изменён');
      setCurrentPwd('');
      setNewPwd('');
      setTimeout(() => {
        setEditingPassword(false);
        setPwdSuccess('');
      }, 1500);
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Ошибка смены пароля');
    } finally {
      setPwdSaving(false);
    }
  }, [currentPwd, newPwd]);

  return (
    <div className="flex flex-col items-center py-6 px-4">
      {/* Аватар с кнопкой смены */}
      <div className="relative">
        <Avatar size={120} name={displayName} src={user?.avatar_url} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
          className="absolute bottom-0 right-0 w-9 h-9 rounded-full flex items-center justify-center border-2 border-black"
          style={{ background: '#007AFF' }}
          aria-label="Сменить аватар"
        >
          {avatarUploading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera size={16} color="white" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Имя */}
      {editingName ? (
        <div className="flex items-center gap-2 mt-3">
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            className="bg-transparent text-white text-[17px] font-semibold text-center border-b border-blue-500 outline-none px-2 py-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName();
              if (e.key === 'Escape') { setEditingName(false); setNameValue(displayName); }
            }}
          />
          <button onClick={handleSaveName} disabled={nameSaving} aria-label="Сохранить имя">
            <Check size={20} color="#30D158" />
          </button>
          <button onClick={() => { setEditingName(false); setNameValue(displayName); }} aria-label="Отмена">
            <X size={20} color="#FF453A" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setNameValue(displayName); setEditingName(true); }}
          className="flex items-center gap-2 mt-3 group"
        >
          <h2 className="text-[17px] font-semibold text-white">{displayName}</h2>
          <span className="text-[12px] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: '#007AFF' }}>
            изменить
          </span>
        </button>
      )}

      <p className="text-[14px] mt-1" style={{ color: '#ABABAF' }}>{email}</p>

      {/* Кнопка смены пароля */}
      <button
        onClick={() => { setEditingPassword(!editingPassword); setPwdError(''); setPwdSuccess(''); }}
        className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg text-[13px]"
        style={{ background: '#1C1C1E', color: '#007AFF' }}
      >
        <KeyRound size={14} />
        Сменить пароль
      </button>

      {/* Форма смены пароля */}
      {editingPassword && (
        <div className="w-full max-w-[320px] mt-3 flex flex-col gap-2">
          <div className="relative">
            <input
              type={showCurrentPwd ? 'text' : 'password'}
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              placeholder="Текущий пароль"
              className="w-full bg-transparent text-white text-[14px] border rounded-lg px-3 py-2 pr-10 outline-none focus:border-blue-500"
              style={{ borderColor: '#38383A' }}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPwd(!showCurrentPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label={showCurrentPwd ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showCurrentPwd ? <EyeOff size={16} color="#636366" /> : <Eye size={16} color="#636366" />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showNewPwd ? 'text' : 'password'}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Новый пароль (мин. 6 символов)"
              className="w-full bg-transparent text-white text-[14px] border rounded-lg px-3 py-2 pr-10 outline-none focus:border-blue-500"
              style={{ borderColor: '#38383A' }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(); }}
            />
            <button
              type="button"
              onClick={() => setShowNewPwd(!showNewPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label={showNewPwd ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showNewPwd ? <EyeOff size={16} color="#636366" /> : <Eye size={16} color="#636366" />}
            </button>
          </div>
          {pwdError && <p className="text-[12px]" style={{ color: '#FF453A' }}>{pwdError}</p>}
          {pwdSuccess && <p className="text-[12px]" style={{ color: '#30D158' }}>{pwdSuccess}</p>}
          <button
            onClick={handleChangePassword}
            disabled={pwdSaving}
            className="py-2 rounded-lg text-[14px] font-semibold"
            style={{ background: '#007AFF', color: 'white', opacity: pwdSaving ? 0.5 : 1 }}
          >
            {pwdSaving ? 'Сохранение...' : 'Сохранить пароль'}
          </button>
        </div>
      )}
    </div>
  );
}


// ==================== Главный экран ====================

/** Экран настроек в стиле iOS */
export function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);

  // Настройки из стора
  const theme = useSettingsStore((s) => s.theme);
  const notificationsEnabled = useSettingsStore((s) => s.notifications_enabled);
  const notificationPreview = useSettingsStore((s) => s.notification_preview);
  const showOnlineStatus = useSettingsStore((s) => s.show_online_status);
  const readReceipts = useSettingsStore((s) => s.read_receipts);
  const appLock = useSettingsStore((s) => s.app_lock);
  const notificationSound = useSettingsStore((s) => s.notification_sound);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const loaded = useSettingsStore((s) => s.loaded);

  // Загрузить настройки при монтировании
  useEffect(() => {
    if (!loaded) {
      fetchSettings();
    }
  }, [loaded, fetchSettings]);

  // Циклическое переключение темы
  const cycleTheme = useCallback(() => {
    const idx = THEME_ORDER.indexOf(theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    updateSetting('theme', next);
  }, [theme, updateSetting]);

  // Уведомления вкл/выкл
  const toggleNotifications = useCallback(() => {
    updateSetting('notifications_enabled', !notificationsEnabled);
  }, [notificationsEnabled, updateSetting]);

  // Циклическое переключение предпросмотра
  const cyclePreview = useCallback(() => {
    const idx = PREVIEW_ORDER.indexOf(notificationPreview);
    const next = PREVIEW_ORDER[(idx + 1) % PREVIEW_ORDER.length];
    updateSetting('notification_preview', next);
  }, [notificationPreview, updateSetting]);

  // Циклическое переключение онлайн-статуса
  const cycleOnline = useCallback(() => {
    const idx = ONLINE_ORDER.indexOf(showOnlineStatus);
    const next = ONLINE_ORDER[(idx + 1) % ONLINE_ORDER.length];
    updateSetting('show_online_status', next);
  }, [showOnlineStatus, updateSetting]);

  // Отчёты о прочтении
  const toggleReadReceipts = useCallback(() => {
    updateSetting('read_receipts', !readReceipts);
  }, [readReceipts, updateSetting]);

  // Блокировка приложения
  const toggleAppLock = useCallback(() => {
    updateSetting('app_lock', !appLock);
  }, [appLock, updateSetting]);

  const handleLogout = useCallback(() => {
    disconnectWS();
    logout();
  }, [logout]);

  return (
    <div className="flex flex-col h-full bg-black overflow-y-auto">
      {/* Профиль — редактирование */}
      <ProfileEditor />

      {/* Основные настройки */}
      <div className="rounded-[10px] mx-4 overflow-hidden" style={{ background: '#1C1C1E' }}>
        <SettingsRow
          icon={<User size={20} color="#007AFF" aria-hidden="true" />}
          label="Профиль"
          value="Изменить"
          onClick={() => {
            // Скроллим к верху страницы — редактирование уже там
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
        <Divider />
        <SettingsRow
          icon={<Palette size={20} color="#FF9500" aria-hidden="true" />}
          label="Тема"
          value={THEME_LABELS[theme] || 'Тёмная'}
          onClick={cycleTheme}
        />
      </div>

      <SectionHeader title="Уведомления" />
      <div className="rounded-[10px] mx-4 overflow-hidden" style={{ background: '#1C1C1E' }}>
        <SettingsRow
          icon={<Bell size={20} color="#FF453A" aria-hidden="true" />}
          label="Уведомления"
          value={notificationsEnabled ? 'Включены' : 'Выключены'}
          onClick={toggleNotifications}
        />
        <Divider />
        <SettingsRow
          icon={<Bell size={20} color="#FF453A" aria-hidden="true" />}
          label="Звук"
          value={notificationSound === 'default' ? 'По умолчанию' : notificationSound}
        />
        <Divider />
        <SettingsRow
          icon={<Bell size={20} color="#FF453A" aria-hidden="true" />}
          label="Предпросмотр"
          value={PREVIEW_LABELS[notificationPreview] || 'Всегда'}
          onClick={cyclePreview}
        />
      </div>

      <SectionHeader title="Конфиденциальность" />
      <div className="rounded-[10px] mx-4 overflow-hidden" style={{ background: '#1C1C1E' }}>
        <SettingsRow
          icon={<Shield size={20} color="#30D158" aria-hidden="true" />}
          label="Онлайн-статус"
          value={ONLINE_LABELS[showOnlineStatus] || 'Все'}
          onClick={cycleOnline}
        />
        <Divider />
        <SettingsRow
          icon={<Shield size={20} color="#30D158" aria-hidden="true" />}
          label="Отчёты о прочтении"
          value={readReceipts ? 'Включены' : 'Выключены'}
          onClick={toggleReadReceipts}
        />
        <Divider />
        <SettingsRow
          icon={<Lock size={20} color="#30D158" aria-hidden="true" />}
          label="Блокировка приложения"
          value={appLock ? 'Вкл' : 'Выкл'}
          onClick={toggleAppLock}
        />
      </div>

      <SectionHeader title="Данные" />
      <div className="rounded-[10px] mx-4 overflow-hidden" style={{ background: '#1C1C1E' }}>
        <SettingsRow
          icon={<HardDrive size={20} color="#5856D6" aria-hidden="true" />}
          label="Хранилище"
          value="Скоро"
        />
        <Divider />
        <SettingsRow
          icon={<Lock size={20} color="#30D158" aria-hidden="true" />}
          label="Шифрование"
          value="Signal Protocol"
        />
      </div>

      <SectionHeader title="О приложении" />
      <div className="rounded-[10px] mx-4 overflow-hidden" style={{ background: '#1C1C1E' }}>
        <SettingsRow
          icon={<Info size={20} color="#8E8E93" aria-hidden="true" />}
          label="Версия"
          value="1.0.0 (Sprint 6)"
        />
      </div>

      {/* Кнопка выхода */}
      <div className="mx-4 mt-6 mb-8">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-[12px] rounded-[10px] text-[16px] font-semibold"
          style={{ background: '#1C1C1E', color: '#FF453A' }}
        >
          <LogOut size={18} color="#FF453A" aria-hidden="true" />
          Выйти
        </button>
      </div>
    </div>
  );
}
