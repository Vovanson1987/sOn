import SwiftUI

/// Экран настроек в стиле iOS
struct SettingsView: View {
    var body: some View {
        NavigationStack {
            List {
                // Профиль
                Section {
                    HStack(spacing: 16) {
                        Circle()
                            .fill(SonColor.primary)
                            .frame(width: 60, height: 60)
                            .overlay {
                                Text("В")
                                    .font(.system(size: 24, weight: .bold))
                                    .foregroundColor(.white)
                            }

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Владимир")
                                .font(.system(size: 18, weight: .semibold))
                            Text("+7 (999) 123-45-67")
                                .font(.system(size: 14))
                                .foregroundColor(SonColor.textSecondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                // Основные
                Section("Основные") {
                    SettingRow(icon: "person.fill", title: "Профиль", value: "Изменить")
                    SettingRow(icon: "paintpalette.fill", title: "Тема", value: "Тёмная")
                }

                // Уведомления
                Section("Уведомления") {
                    SettingRow(icon: "bell.fill", title: "Уведомления", value: "Включены")
                    SettingRow(icon: "speaker.wave.2.fill", title: "Звук", value: "По умолчанию")
                }

                // Конфиденциальность
                Section("Конфиденциальность") {
                    SettingRow(icon: "shield.fill", title: "Онлайн-статус", value: "Все")
                    SettingRow(icon: "eye.fill", title: "Отчёты о прочтении", value: "Вкл")
                    SettingRow(icon: "lock.fill", title: "Блокировка", value: "Выкл")
                }

                // Данные
                Section("Данные") {
                    SettingRow(icon: "internaldrive.fill", title: "Хранилище", value: "1.2 ГБ")
                    SettingRow(icon: "lock.shield.fill", title: "Шифрование", value: "Signal Protocol")
                }

                // О приложении
                Section("О приложении") {
                    SettingRow(icon: "info.circle.fill", title: "Версия", value: "1.0.0")
                }
            }
            .navigationTitle("Настройки")
        }
    }
}

/// Строка настройки
struct SettingRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(SonColor.primary)
                .frame(width: 24)
            Text(title)
            Spacer()
            Text(value)
                .foregroundColor(SonColor.textSecondary)
        }
    }
}
