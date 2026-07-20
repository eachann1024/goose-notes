import AppKit

@MainActor
final class SettingsWindowController: NSWindowController {
    private let preferences: AppPreferences
    private let appearancePopup = NSPopUpButton()
    private let fontPopup = NSPopUpButton()
    private let fullWidthSwitch = NSSwitch()

    init(preferences: AppPreferences = .shared) {
        self.preferences = preferences
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 245),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "设置"
        window.isReleasedWhenClosed = false
        super.init(window: window)
        setup()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        guard let content = window?.contentView else { return }
        let title = NSTextField(labelWithString: "外观与阅读")
        title.font = .systemFont(ofSize: 18, weight: .semibold)
        title.textColor = DesignTokens.Color.textPrimary

        for mode in AppearanceMode.allCases {
            appearancePopup.addItem(withTitle: mode.title)
            appearancePopup.lastItem?.representedObject = mode.rawValue
        }
        appearancePopup.selectItem(withTitle: preferences.appearanceMode.title)
        appearancePopup.target = self
        appearancePopup.action = #selector(appearanceChanged(_:))

        for mode in EditorFontMode.allCases {
            fontPopup.addItem(withTitle: mode.title)
            fontPopup.lastItem?.representedObject = mode.rawValue
        }
        fontPopup.selectItem(withTitle: preferences.editorFontMode.title)
        fontPopup.target = self
        fontPopup.action = #selector(fontChanged(_:))

        fullWidthSwitch.state = preferences.editorFullWidth ? .on : .off
        fullWidthSwitch.target = self
        fullWidthSwitch.action = #selector(fullWidthChanged(_:))

        let grid = NSGridView(views: [
            [NSTextField(labelWithString: "界面外观"), appearancePopup],
            [NSTextField(labelWithString: "正文字体"), fontPopup],
            [NSTextField(labelWithString: "使用宽版编辑器"), fullWidthSwitch],
        ])
        grid.rowSpacing = 14
        grid.columnSpacing = 20
        grid.column(at: 0).xPlacement = .trailing
        grid.column(at: 1).xPlacement = .leading

        let note = NSTextField(wrappingLabelWithString: "界面字体始终使用系统字体。正文设置只影响笔记编辑器。")
        note.textColor = DesignTokens.Color.textSecondary
        note.font = .systemFont(ofSize: 12)

        let stack = NSStackView(views: [title, grid, note])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -28),
            stack.topAnchor.constraint(equalTo: content.topAnchor, constant: 26),
            note.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])
        window?.center()
    }

    @objc private func appearanceChanged(_ sender: NSPopUpButton) {
        guard let raw = sender.selectedItem?.representedObject as? String,
              let mode = AppearanceMode(rawValue: raw) else { return }
        preferences.appearanceMode = mode
        NSApp.appearance = mode.appearance
    }

    @objc private func fontChanged(_ sender: NSPopUpButton) {
        guard let raw = sender.selectedItem?.representedObject as? String,
              let mode = EditorFontMode(rawValue: raw) else { return }
        preferences.editorFontMode = mode
    }

    @objc private func fullWidthChanged(_ sender: NSSwitch) {
        preferences.editorFullWidth = sender.state == .on
    }
}
