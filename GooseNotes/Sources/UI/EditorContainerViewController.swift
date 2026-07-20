import AppKit

final class NotificationTokenBag: @unchecked Sendable {
    var values: [NSObjectProtocol] = []

    deinit {
        for value in values { NotificationCenter.default.removeObserver(value) }
    }
}

@MainActor
final class EditorContainerViewController: NSViewController {
    var onSelectTab: ((String) -> Void)?
    var onCloseTab: ((String) -> Void)?
    var onTogglePin: ((String) -> Void)?
    var onToggleFavorite: ((String) -> Void)?
    var onCreatePage: (() -> Void)?
    var onShowError: ((String) -> Void)?

    private let store: NotebookStore
    private let preferences: AppPreferences
    private let webController: EditorWebViewController
    private let tabStrip = TabStripView()
    private let saveLabel = NSTextField(labelWithString: "")
    private let favoriteButton = NSButton()
    private let moreButton = NSPopUpButton()
    private let editorHost = NSView()
    private let emptyState = NSView()
    private let emptyTitle = NSTextField(labelWithString: "选择一个页面开始写作")
    private let emptyBody = NSTextField(labelWithString: "从侧边栏打开页面，或新建一个空白页面。")
    private let emptyAction = NSButton(title: "新建页面", target: nil, action: nil)
    private let observerTokens = NotificationTokenBag()

    init(store: NotebookStore, preferences: AppPreferences = .shared) {
        self.store = store
        self.preferences = preferences
        webController = EditorWebViewController(store: store, preferences: preferences)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func loadView() {
        let root = NSView()
        root.wantsLayer = true
        root.layer?.backgroundColor = DesignTokens.Color.canvas.cgColor
        view = root

        let topBar = NSView()
        topBar.wantsLayer = true
        topBar.layer?.backgroundColor = DesignTokens.Color.sidebar.cgColor

        saveLabel.font = .systemFont(ofSize: 12)
        saveLabel.textColor = DesignTokens.Color.textSecondary
        saveLabel.alignment = .right
        saveLabel.setAccessibilityElement(true)
        saveLabel.setAccessibilityRole(.staticText)
        saveLabel.setAccessibilityLabel("保存状态")

        favoriteButton.isBordered = false
        favoriteButton.image = NSImage(systemSymbolName: "star", accessibilityDescription: "收藏页面")
        favoriteButton.target = self
        favoriteButton.action = #selector(toggleFavorite(_:))
        favoriteButton.toolTip = "收藏页面"

        moreButton.isBordered = false
        moreButton.image = NSImage(systemSymbolName: "ellipsis", accessibilityDescription: "更多页面操作")
        moreButton.menu = makeMoreMenu()
        moreButton.toolTip = "更多页面操作"

        tabStrip.onSelect = { [weak self] id in self?.onSelectTab?(id) }
        tabStrip.onClose = { [weak self] id in self?.onCloseTab?(id) }
        tabStrip.onTogglePin = { [weak self] id in self?.onTogglePin?(id) }

        let actions = NSStackView(views: [saveLabel, favoriteButton, moreButton])
        actions.orientation = .horizontal
        actions.alignment = .centerY
        actions.spacing = 5
        saveLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        for item in [tabStrip, actions] {
            item.translatesAutoresizingMaskIntoConstraints = false
            topBar.addSubview(item)
        }
        NSLayoutConstraint.activate([
            tabStrip.leadingAnchor.constraint(equalTo: topBar.leadingAnchor),
            tabStrip.topAnchor.constraint(equalTo: topBar.topAnchor),
            tabStrip.bottomAnchor.constraint(equalTo: topBar.bottomAnchor),
            actions.leadingAnchor.constraint(greaterThanOrEqualTo: tabStrip.trailingAnchor, constant: 6),
            actions.trailingAnchor.constraint(equalTo: topBar.trailingAnchor, constant: -8),
            actions.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),
            actions.widthAnchor.constraint(lessThanOrEqualToConstant: 210),
        ])

        addChild(webController)
        let webView = webController.view
        webView.translatesAutoresizingMaskIntoConstraints = false
        editorHost.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: editorHost.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: editorHost.trailingAnchor),
            webView.topAnchor.constraint(equalTo: editorHost.topAnchor),
            webView.bottomAnchor.constraint(equalTo: editorHost.bottomAnchor),
        ])
        webController.onLoadFailure = { [weak self] message in self?.onShowError?(message) }

        let emptyIcon = NSImageView(image: NSImage(systemSymbolName: "note.text", accessibilityDescription: nil) ?? NSImage())
        emptyIcon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 38, weight: .light)
        emptyIcon.contentTintColor = DesignTokens.Color.accent
        emptyTitle.font = .systemFont(ofSize: 18, weight: .semibold)
        emptyTitle.textColor = DesignTokens.Color.textPrimary
        emptyBody.font = .systemFont(ofSize: 13)
        emptyBody.textColor = DesignTokens.Color.textSecondary
        emptyAction.target = self
        emptyAction.action = #selector(createPage(_:))
        emptyAction.bezelStyle = .rounded
        emptyAction.keyEquivalent = "\r"
        let emptyStack = NSStackView(views: [emptyIcon, emptyTitle, emptyBody, emptyAction])
        emptyStack.orientation = .vertical
        emptyStack.alignment = .centerX
        emptyStack.spacing = 10
        emptyStack.setCustomSpacing(18, after: emptyBody)
        emptyStack.translatesAutoresizingMaskIntoConstraints = false
        emptyState.addSubview(emptyStack)
        NSLayoutConstraint.activate([
            emptyStack.centerXAnchor.constraint(equalTo: emptyState.centerXAnchor),
            emptyStack.centerYAnchor.constraint(equalTo: emptyState.centerYAnchor, constant: -20),
        ])

        for item in [topBar, editorHost, emptyState] {
            item.translatesAutoresizingMaskIntoConstraints = false
            root.addSubview(item)
        }
        NSLayoutConstraint.activate([
            topBar.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            topBar.topAnchor.constraint(equalTo: root.topAnchor),
            topBar.heightAnchor.constraint(equalToConstant: 38),
            editorHost.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            editorHost.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            editorHost.topAnchor.constraint(equalTo: topBar.bottomAnchor),
            editorHost.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            emptyState.leadingAnchor.constraint(equalTo: editorHost.leadingAnchor),
            emptyState.trailingAnchor.constraint(equalTo: editorHost.trailingAnchor),
            emptyState.topAnchor.constraint(equalTo: editorHost.topAnchor),
            emptyState.bottomAnchor.constraint(equalTo: editorHost.bottomAnchor),
        ])

        observerTokens.values.append(NotificationCenter.default.addObserver(
            forName: .libraryDidChange, object: store, queue: .main
        ) { [weak self] _ in Task { @MainActor in self?.reload() } })
        observerTokens.values.append(NotificationCenter.default.addObserver(
            forName: .saveStateDidChange, object: store, queue: .main
        ) { [weak self] _ in Task { @MainActor in self?.updateSaveState() } })
        observerTokens.values.append(NotificationCenter.default.addObserver(
            forName: .preferencesDidChange, object: preferences, queue: .main
        ) { [weak self] _ in Task { @MainActor in self?.webController.sendPreferences() } })
        reload()
    }

    func reload(forceEditor: Bool = false) {
        guard isViewLoaded else { return }
        tabStrip.reload(tabs: store.document.tabs, pages: store.document.pages, activePageID: store.document.activePageID)
        updateSaveState()
        if let page = store.activePage {
            editorHost.isHidden = false
            emptyState.isHidden = true
            favoriteButton.isEnabled = true
            moreButton.isEnabled = true
            favoriteButton.image = NSImage(
                systemSymbolName: page.isFavorite ? "star.fill" : "star",
                accessibilityDescription: page.isFavorite ? "取消收藏" : "收藏页面"
            )
            favoriteButton.toolTip = page.isFavorite ? "取消收藏" : "收藏页面"
            webController.present(page: page, force: forceEditor)
        } else {
            editorHost.isHidden = true
            emptyState.isHidden = false
            favoriteButton.isEnabled = false
            moreButton.isEnabled = false
            webController.clear()
        }
    }

    func flush(completion: @escaping (Bool) -> Void) {
        webController.flush(completion: completion)
    }

    func dispatchEditorCommand(_ command: String) {
        webController.dispatch(command: command)
    }

    func exportMarkdown(completion: @escaping (Result<(String, String), Error>) -> Void) {
        webController.exportMarkdown(completion: completion)
    }

    func importMarkdown(title: String, markdown: String, completion: @escaping (Bool) -> Void) {
        webController.importMarkdown(title: title, markdown: markdown, completion: completion)
    }

    func printEditor() { webController.printEditor() }

    private func updateSaveState() {
        switch store.saveState {
        case .idle:
            saveLabel.stringValue = ""
            saveLabel.textColor = DesignTokens.Color.textSecondary
        case .saving:
            saveLabel.stringValue = "正在保存…"
            saveLabel.textColor = DesignTokens.Color.textSecondary
        case .saved:
            saveLabel.stringValue = "已保存"
            saveLabel.textColor = DesignTokens.Color.success
        case .failed:
            saveLabel.stringValue = "保存失败"
            saveLabel.textColor = DesignTokens.Color.destructive
        }
    }

    private func makeMoreMenu() -> NSMenu {
        let menu = NSMenu()
        let exportItem = menu.addItem(withTitle: "导出 Markdown…", action: #selector(exportFromMenu(_:)), keyEquivalent: "")
        exportItem.target = self
        let printItem = menu.addItem(withTitle: "打印…", action: #selector(printFromMenu(_:)), keyEquivalent: "")
        printItem.target = self
        menu.addItem(.separator())
        let trashItem = menu.addItem(withTitle: "移到回收站", action: #selector(trashFromMenu(_:)), keyEquivalent: "")
        trashItem.target = self
        return menu
    }

    @objc private func toggleFavorite(_ sender: Any?) {
        if let pageID = store.document.activePageID { onToggleFavorite?(pageID) }
    }

    @objc private func createPage(_ sender: Any?) { onCreatePage?() }
    @objc private func exportFromMenu(_ sender: Any?) { NSApp.sendAction(#selector(AppDelegate.exportMarkdown(_:)), to: nil, from: sender) }
    @objc private func printFromMenu(_ sender: Any?) { printEditor() }
    @objc private func trashFromMenu(_ sender: Any?) { NSApp.sendAction(#selector(AppDelegate.trashActivePage(_:)), to: nil, from: sender) }
}
