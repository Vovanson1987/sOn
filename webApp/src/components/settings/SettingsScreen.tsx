import { ChevronRight, User, Palette, Bell, Shield, HardDrive, Lock, Info, LogOut } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { useAuthStore } from '@stores/authStore';
import { disconnectWS } from '@/api/client';


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

/** Экран настроек в стиле iOS */
export function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const displayName = user?.display_name || 'Пользователь';
  const email = user?.email || '';

  const handleLogout = () => {
    disconnectWS();
    logout();
  };

  return (
    <div className="flex flex-col h-full bg-black overflow-y-auto">
      {/* Профиль */}
      <div className="flex flex-col items-center py-6">
        <Avatar size={120} name={displayName} src={user?.avatar_url} />
        <h2 className="text-[17px] font-semibold text-white mt-3">{displayName}</h2>
        <p className="text-[14px] mt-1" style={{ color: '#ABABAF' }}>{email}</p>
      </div>

      <div className="rounded-[10px] mx-4 overflow-hidden" style={{ background: '#1C1C1E' }}>
        <SettingsRow
          icon={<User size={20} color="#007AFF" aria-hidden="true" />}
          label="Профиль"
          value="Изменить"
        />
        <Divider />
        <SettingsRow
          icon={<Palette size={20} color="#FF9500" aria-hidden="true" />}
          label="Тема"
          value="Тёмная"
        />
      </div>

      <SectionHeader title="Уведомления" />
      <div className="rounded-[10px] mx-4 overflow-hidden" style={{ background: '#1C1C1E' }}>
        <SettingsRow
          icon={<Bell size={20} color="#FF453A" aria-hidden="true" />}
          label="Уведомления"
          value="Включены"
        />
        <Divider />
        <SettingsRow
          icon={<Bell size={20} color="#FF453A" aria-hidden="true" />}
          label="Звук"
          value="По умолчанию"
        />
        <Divider />
        <SettingsRow
          icon={<Bell size={20} color="#FF453A" aria-hidden="true" />}
          label="Предпросмотр"
          value="Всегда"
        />
      </div>

      <SectionHeader title="Конфиденциальность" />
      <div className="rounded-[10px] mx-4 overflow-hidden" style={{ background: '#1C1C1E' }}>
        <SettingsRow
          icon={<Shield size={20} color="#30D158" aria-hidden="true" />}
          label="Онлайн-статус"
          value="Все"
        />
        <Divider />
        <SettingsRow
          icon={<Shield size={20} color="#30D158" aria-hidden="true" />}
          label="Отчёты о прочтении"
          value="Включены"
        />
        <Divider />
        <SettingsRow
          icon={<Lock size={20} color="#30D158" aria-hidden="true" />}
          label="Блокировка приложения"
          value="Выкл"
        />
      </div>

      <SectionHeader title="Данные" />
      <div className="rounded-[10px] mx-4 overflow-hidden" style={{ background: '#1C1C1E' }}>
        <SettingsRow
          icon={<HardDrive size={20} color="#5856D6" aria-hidden="true" />}
          label="Хранилище"
          value="1.2 ГБ"
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
