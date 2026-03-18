import SwiftUI

/// Модель чата для списка
struct ChatPreview: Identifiable {
    let id: String
    let name: String
    let lastMessage: String
    let time: String
    let isOnline: Bool
    let isSecret: Bool
    let initials: String
    let color: Color
}

/// Моковые данные
let mockChats: [ChatPreview] = [
    .init(id: "1", name: "Алексей", lastMessage: "🔒 Зашифрованное сообщение", time: "13:15", isOnline: false, isSecret: true, initials: "АЛ", color: Color(hex: 0xFFC107)),
    .init(id: "2", name: "Vladimir", lastMessage: "Привет! Как дела?", time: "12:00", isOnline: true, isSecret: false, initials: "VL", color: .gray),
    .init(id: "3", name: "🏢 Работа SCIF", lastMessage: "Совещание перенесено на 15:00", time: "11:30", isOnline: false, isSecret: false, initials: "PS", color: .pink),
    .init(id: "4", name: "🏠 Семья", lastMessage: "Всех с праздником!", time: "10:00", isOnline: false, isSecret: false, initials: "C", color: .green),
    .init(id: "5", name: "900", lastMessage: "Владимир Николаевич, вы можете получить...", time: "Вчера", isOnline: false, isSecret: false, initials: "", color: .gray),
    .init(id: "6", name: "Ксенька Доч", lastMessage: "📎 Файл: 49574f08d447...", time: "Пн", isOnline: true, isSecret: false, initials: "КД", color: Color(hex: 0xFFC107)),
]

/// Экран списка чатов
struct ChatListView: View {
    @State private var searchText = ""

    var filteredChats: [ChatPreview] {
        searchText.isEmpty ? mockChats : mockChats.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            List(filteredChats) { chat in
                ChatRow(chat: chat)
                    .listRowBackground(SonColor.background)
                    .listRowSeparatorTint(SonColor.separator)
            }
            .listStyle(.plain)
            .searchable(text: $searchText, prompt: "Поиск")
            .navigationTitle("Сообщения")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Править") { }
                        .tint(SonColor.primary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { }) {
                        Image(systemName: "square.and.pencil")
                    }
                    .tint(SonColor.primary)
                }
            }
        }
    }
}

/// Строка чата в списке
struct ChatRow: View {
    let chat: ChatPreview

    var body: some View {
        HStack(spacing: 12) {
            // Аватар
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(chat.color)
                    .frame(width: 50, height: 50)
                    .overlay {
                        Text(chat.initials)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                    }

                if chat.isOnline {
                    Circle()
                        .fill(SonColor.online)
                        .frame(width: 12, height: 12)
                        .overlay {
                            Circle().stroke(SonColor.background, lineWidth: 2)
                        }
                }
            }

            // Текст
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(chat.isSecret ? "🔒 \(chat.name)" : chat.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    Spacer()

                    Text(chat.time)
                        .font(.system(size: 13))
                        .foregroundColor(SonColor.textSecondary)
                }

                Text(chat.lastMessage)
                    .font(.system(size: 14))
                    .foregroundColor(SonColor.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}
