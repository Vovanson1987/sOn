import SwiftUI

/// Корневой View с TabView навигацией
struct ContentView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            ChatListView()
                .tabItem {
                    Image(systemName: "message.fill")
                    Text("Чаты")
                }
                .tag(0)

            CallsPlaceholder()
                .tabItem {
                    Image(systemName: "phone.fill")
                    Text("Звонки")
                }
                .tag(1)

            ContactsPlaceholder()
                .tabItem {
                    Image(systemName: "person.2.fill")
                    Text("Контакты")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("Настройки")
                }
                .tag(3)
        }
        .tint(Color(hex: 0x007AFF))
    }
}

struct CallsPlaceholder: View {
    var body: some View {
        Text("Журнал звонков")
            .foregroundColor(.secondary)
    }
}

struct ContactsPlaceholder: View {
    var body: some View {
        Text("Контакты")
            .foregroundColor(.secondary)
    }
}
