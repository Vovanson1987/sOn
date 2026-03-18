import SwiftUI

/// Точка входа iOS приложения sOn Messenger
@main
struct SonApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .preferredColorScheme(.dark)
        }
    }
}

/// Глобальное состояние приложения
class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUserId: String?
}
