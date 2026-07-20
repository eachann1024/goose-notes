// Generated from Design/tokens.json. Do not edit.
import AppKit

enum DesignTokens {
    enum Color {
        static let canvas = dynamic(light: "#FFFFFF", dark: "#1F1F1E")
        static let sidebar = dynamic(light: "#F5F3F0", dark: "#282725")
        static let surfaceMuted = dynamic(light: "#ECE9E5", dark: "#34322F")
        static let surfaceRaised = dynamic(light: "#FFFFFF", dark: "#302F2D")
        static let textPrimary = dynamic(light: "#242321", dark: "#F0EEEA")
        static let textSecondary = dynamic(light: "#68645F", dark: "#B9B4AD")
        static let separator = dynamic(light: "#DAD6D0", dark: "#46423E")
        static let accent = dynamic(light: "#C85F3D", dark: "#E17A57")
        static let accentMuted = dynamic(light: "#F6E5DF", dark: "#513429")
        static let focus = dynamic(light: "#9C472E", dark: "#F09A7C")
        static let success = dynamic(light: "#357A53", dark: "#72C795")
        static let warning = dynamic(light: "#946516", dark: "#E0B562")
        static let destructive = dynamic(light: "#B8413B", dark: "#F07870")
        static let selection = dynamic(light: "#DCEAF8", dark: "#294968")

        private static func dynamic(light: String, dark: String) -> NSColor {
            NSColor(name: nil) { appearance in
                let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
                return NSColor(hex: isDark ? dark : light) ?? .controlTextColor
            }
        }
    }

    enum Space {
        static let xxs: CGFloat = 2
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
    }

    enum Radius {
        static let small: CGFloat = 6
        static let medium: CGFloat = 10
        static let large: CGFloat = 14
    }

    enum Motion {
        static let fast: TimeInterval = 120
        static let standard: TimeInterval = 180
        static let slow: TimeInterval = 220
    }

    enum Typography {
        static let body: CGFloat = 16
        static let label: CGFloat = 13
        static let caption: CGFloat = 12
        static let title: CGFloat = 36
        static let lineHeight: CGFloat = 1.72
        static let measure: CGFloat = 68
    }
}

private extension NSColor {
    convenience init?(hex: String) {
        let value = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard value.count == 6, let number = Int(value, radix: 16) else { return nil }
        self.init(
            srgbRed: CGFloat((number >> 16) & 0xFF) / 255,
            green: CGFloat((number >> 8) & 0xFF) / 255,
            blue: CGFloat(number & 0xFF) / 255,
            alpha: 1
        )
    }
}
