import SwiftUI

/// Расширение Color для создания из hex-значения
extension Color {
    init(hex: UInt, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

/// Цветовая палитра sOn в стиле iMessage Dark
enum SonColor {
    static let primary = Color(hex: 0x007AFF)
    static let secondary = Color(hex: 0x34C759)
    static let background = Color(hex: 0x000000)
    static let surface = Color(hex: 0x1C1C1E)
    static let surfaceVariant = Color(hex: 0x2C2C2E)
    static let textSecondary = Color(hex: 0x8E8E93)
    static let separator = Color(hex: 0x38383A)
    static let bubbleOutgoing = Color(hex: 0x007AFF)
    static let bubbleIncoming = Color(hex: 0x26252A)
    static let destructive = Color(hex: 0xFF3B30)
    static let online = Color(hex: 0x34C759)
}
