import { useState, useEffect } from 'react';
import { Lock, Check } from 'lucide-react';

interface KeyExchangeAnimationProps {
  contactName: string;
  onComplete: () => void;
}

const STEPS = [
  'Генерация ключевой пары (Curve25519)...',
  'Обмен ключами (X3DH)...',
  'Инициализация Double Ratchet...',
  '🔒 Защищённое соединение установлено',
];

/** Анимация обмена ключами при создании секретного чата */
export function KeyExchangeAnimation({ contactName, onComplete }: KeyExchangeAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep >= STEPS.length) {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setCurrentStep((s) => s + 1), 800);
    return () => clearTimeout(timer);
  }, [currentStep, onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Установка защищённого соединения"
    >
      <div className="flex flex-col items-center max-w-[400px] px-8">
        {/* Два замка */}
        <div className="flex items-center gap-8 mb-8">
          <Lock size={40} color="#30D158" />
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-[6px] h-[6px] rounded-full"
                style={{
                  background: '#30D158',
                  animation: `typingDots 1.2s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
          <Lock size={40} color="#30D158" />
        </div>

        {/* Имя контакта */}
        <p className="text-[16px] text-white mb-6">
          Подключение к <span className="font-semibold">{contactName}</span>
        </p>

        {/* Прогресс */}
        <p className="text-[13px] mb-4" style={{ color: '#ABABAF' }} role="status" aria-live="polite">
          {Math.min(Math.round((currentStep / STEPS.length) * 100), 100)}%
        </p>

        {/* Этапы */}
        <div className="w-full space-y-3">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-3 transition-opacity"
              style={{
                opacity: i <= currentStep ? 1 : 0.2,
                transition: 'opacity 0.3s ease',
              }}
            >
              {i < currentStep ? (
                <Check size={18} color="#30D158" />
              ) : i === currentStep ? (
                <div
                  className="w-[18px] h-[18px] rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: '#30D158', borderTopColor: 'transparent' }}
                />
              ) : (
                <div className="w-[18px] h-[18px]" />
              )}
              <span
                className="text-[14px]"
                style={{ color: i <= currentStep ? '#fff' : '#636366' }}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
