import AppKit
import UniformTypeIdentifiers

private extension UTType {
    static var gooseMarkdown: UTType {
        UTType(filenameExtension: "md", conformingTo: .plainText) ?? .plainText
    }
}

extension NSToolbarItem.Identifier {
    static let gooseToggleSidebar = NSToolbarItem.Identifier("GooseNotes.ToggleSidebar")
    static let gooseNewPage = NSToolbarItem.Identifier("GooseNotes.NewPage")
    static let gooseSearch = NSToolbarItem.Identifier("GooseNotes.Search")
}

@MainActor
final class MainWindowController: NSWindowController, NSWindowDelegate, NSToolbarDelegate {
    let store: NotebookStore
    let splitController: MainSplitViewController
    private let structureUndoManager = UndoManager()

    init(store: NotebookStore) {
        self.store = store
        splitController = MainSplitViewController(store: store)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1180, height: 760),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "鹅的笔记"
        window.titleVisibility = .hidden
        window.tabbingMode = .disallowed
        window.minSize = NSSize(width: 780, height: 520)
        window.contentViewController = splitController
        window.isReleasedWhenClosed = false
        super.init(window: window)
        store.undoManager = structureUndoManager
        setupWindow()
        wireActions()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func windowWillReturnUndoManager(_ window: NSWindow) -> UndoManager? { structureUndoManager }

    func show() {
        guard let window else { return }
        window.setFrameAutosaveName("GooseNotes.MainWindow")
        if !window.setFrameUsingName("GooseNotes.MainWindow") { window.center() }
        showWindow(nil)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        splitController.sidebarController.reload()
        splitController.editorController.reload(forceEditor: true)
    }

    func flushEditor(completion: @escaping (Bool) -> Void) {
        splitController.editorController.flush(completion: completion)
    }

    func createPage(parentID: String? = nil) {
        flushEditor { [weak self] success in
            guard let self, success else { return }
            guard let page = store.createPage(parentID: parentID) else { return }
            store.openPage(id: page.id, permanent: true)
            splitController.editorController.reload(forceEditor: true)
        }
    }

    func createNotebook() {
        let alert = NSAlert()
        alert.messageText = "新建笔记本"
        alert.informativeText = "笔记本名称可稍后修改。"
        alert.addButton(withTitle: "创建")
        alert.addButton(withTitle: "取消")
        let input = NSTextField(string: "新笔记本")
        input.placeholderString = "笔记本名称"
        input.frame.size = NSSize(width: 280, height: 24)
        alert.accessoryView = input
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        let notebook = store.createNotebook(name: input.stringValue)
        store.selectNotebook(id: notebook.id)
    }

    func renameActiveNotebook() {
        guard let notebook = store.activeNotebook else { return }
        let alert = NSAlert()
        alert.messageText = "重命名笔记本"
        alert.addButton(withTitle: "保存")
        alert.addButton(withTitle: "取消")
        let input = NSTextField(string: notebook.name)
        input.frame.size = NSSize(width: 280, height: 24)
        alert.accessoryView = input
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        store.renameNotebook(id: notebook.id, name: input.stringValue)
    }

    func deleteActiveNotebook() {
        guard let notebook = store.activeNotebook, store.document.notebooks.count > 1 else { return }
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "删除“\(notebook.name)”？"
        alert.informativeText = "笔记本及其中页面会被彻底删除。此操作可立即通过撤销恢复。"
        alert.addButton(withTitle: "删除")
        alert.addButton(withTitle: "取消")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        store.deleteNotebook(id: notebook.id)
    }

    func focusSearch() { splitController.sidebarController.focusSearch() }
    func toggleSidebar() { splitController.toggleSidebar() }

    func toggleFavorite() {
        guard let pageID = store.document.activePageID else { return }
        store.toggleFavorite(id: pageID)
    }

    func trashActivePage() {
        guard let page = store.activePage else { return }
        let alert = NSAlert()
        alert.messageText = "将“\(page.displayTitle)”移到回收站？"
        alert.informativeText = "页面及其子页面可以从回收站恢复。"
        alert.addButton(withTitle: "移到回收站")
        alert.addButton(withTitle: "取消")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        flushEditor { [weak self] success in
            guard let self, success else { return }
            store.trashPage(id: page.id)
        }
    }

    func importMarkdown(urls: [URL]) {
        var pending = urls
        func importNext() {
            guard let url = pending.first else { return }
            pending.removeFirst()
            do {
                let markdown = try String(contentsOf: url, encoding: .utf8)
                let title = url.deletingPathExtension().lastPathComponent
                guard let page = store.createPage(title: title) else { return }
                store.openPage(id: page.id, permanent: true)
                splitController.editorController.reload(forceEditor: true)
                DispatchQueue.main.async { [weak self] in
                    self?.splitController.editorController.importMarkdown(title: title, markdown: markdown) { success in
                        if !success { self?.showError("无法导入 \(url.lastPathComponent)。") }
                        importNext()
                    }
                }
            } catch {
                showError("无法读取 \(url.lastPathComponent)：\(error.localizedDescription)")
                importNext()
            }
        }
        importNext()
    }

    func chooseMarkdownToImport() {
        let panel = NSOpenPanel()
        panel.title = "导入 Markdown"
        panel.allowedContentTypes = [.gooseMarkdown, .plainText]
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        guard panel.runModal() == .OK else { return }
        importMarkdown(urls: panel.urls)
    }

    func exportMarkdown() {
        flushEditor { [weak self] success in
            guard let self, success else { return }
            splitController.editorController.exportMarkdown { result in
                switch result {
                case .success(let (title, markdown)):
                    self.presentExportPanel(title: title, markdown: markdown)
                case .failure(let error):
                    self.showError("无法导出页面：\(error.localizedDescription)")
                }
            }
        }
    }

    func dispatchEditorCommand(_ command: String) {
        splitController.editorController.dispatchEditorCommand(command)
    }

    func printEditor() { splitController.editorController.printEditor() }

    func showError(_ message: String) {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "鹅的笔记"
        alert.informativeText = message
        alert.runModal()
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.gooseToggleSidebar, .gooseNewPage, .gooseSearch, .flexibleSpace]
    }

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.gooseToggleSidebar, .flexibleSpace, .gooseSearch, .gooseNewPage]
    }

    func toolbar(
        _ toolbar: NSToolbar,
        itemForItemIdentifier itemIdentifier: NSToolbarItem.Identifier,
        willBeInsertedIntoToolbar flag: Bool
    ) -> NSToolbarItem? {
        let item = NSToolbarItem(itemIdentifier: itemIdentifier)
        switch itemIdentifier {
        case .gooseToggleSidebar:
            item.label = "侧边栏"
            item.image = NSImage(systemSymbolName: "sidebar.left", accessibilityDescription: "显示或隐藏侧边栏")
            item.target = self
            item.action = #selector(toolbarToggleSidebar(_:))
        case .gooseNewPage:
            item.label = "新建页面"
            item.image = NSImage(systemSymbolName: "square.and.pencil", accessibilityDescription: "新建页面")
            item.target = self
            item.action = #selector(toolbarNewPage(_:))
        case .gooseSearch:
            item.label = "搜索"
            item.image = NSImage(systemSymbolName: "magnifyingglass", accessibilityDescription: "搜索笔记")
            item.target = self
            item.action = #selector(toolbarSearch(_:))
        default: return nil
        }
        return item
    }

    private func setupWindow() {
        guard let window else { return }
        window.delegate = self
        window.collectionBehavior.insert(.fullScreenPrimary)
        let toolbar = NSToolbar(identifier: "GooseNotes.MainToolbar")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        window.toolbar = toolbar
        window.toolbarStyle = .unified
    }

    private func wireActions() {
        let sidebar = splitController.sidebarController
        let editor = splitController.editorController
        sidebar.onSelectPage = { [weak self] id, permanent in self?.selectPage(id: id, permanent: permanent) }
        sidebar.onCreatePage = { [weak self] parentID in self?.createPage(parentID: parentID) }
        sidebar.onCreateNotebook = { [weak self] in self?.createNotebook() }
        sidebar.onSelectNotebook = { [weak self] id in
            self?.flushEditor { success in if success { self?.store.selectNotebook(id: id) } }
        }
        sidebar.onRenamePage = { [weak self] id, title in self?.store.renamePage(id: id, title: title) }
        sidebar.onToggleFavorite = { [weak self] id in self?.store.toggleFavorite(id: id) }
        sidebar.onTrashPage = { [weak self] id in self?.store.trashPage(id: id) }
        sidebar.onRestorePage = { [weak self] id in self?.store.restorePage(id: id) }
        sidebar.onDeletePermanently = { [weak self] id in self?.confirmPermanentDelete(id: id) }
        sidebar.onMovePage = { [weak self] id, target, position in self?.store.movePage(id: id, relativeTo: target, position: position) }

        editor.onSelectTab = { [weak self] id in self?.selectPage(id: id, permanent: true) }
        editor.onCloseTab = { [weak self] id in
            self?.flushEditor { success in if success { self?.store.closeTab(pageID: id) } }
        }
        editor.onTogglePin = { [weak self] id in self?.store.toggleTabPinned(pageID: id) }
        editor.onToggleFavorite = { [weak self] id in self?.store.toggleFavorite(id: id) }
        editor.onCreatePage = { [weak self] in self?.createPage() }
        editor.onShowError = { [weak self] message in self?.showError(message) }
    }

    private func selectPage(id: String, permanent: Bool) {
        guard store.document.activePageID != id else {
            if permanent { store.openPage(id: id, permanent: true) }
            return
        }
        flushEditor { [weak self] success in
            guard let self, success else { return }
            store.openPage(id: id, permanent: permanent)
            splitController.editorController.reload(forceEditor: true)
        }
    }

    private func confirmPermanentDelete(id: String) {
        guard let page = store.page(id: id) else { return }
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "彻底删除“\(page.displayTitle)”？"
        alert.informativeText = "此操作无法撤销，页面及其子页面会从本地笔记库移除。"
        alert.addButton(withTitle: "彻底删除")
        alert.addButton(withTitle: "取消")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        store.permanentlyDeletePage(id: id)
    }

    private func presentExportPanel(title: String, markdown: String) {
        let panel = NSSavePanel()
        panel.title = "导出 Markdown"
        panel.allowedContentTypes = [.gooseMarkdown]
        let safeTitle = title
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "/", with: "-")
        panel.nameFieldStringValue = "\(safeTitle.isEmpty ? "未命名" : safeTitle).md"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        var coordinationError: NSError?
        var writeError: Error?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { coordinatedURL in
            do { try markdown.write(to: coordinatedURL, atomically: true, encoding: .utf8) }
            catch { writeError = error }
        }
        if let error = coordinationError ?? writeError as NSError? {
            showError("导出失败：\(error.localizedDescription)")
        }
    }

    @objc private func toolbarToggleSidebar(_ sender: Any?) { toggleSidebar() }
    @objc private func toolbarNewPage(_ sender: Any?) { createPage() }
    @objc private func toolbarSearch(_ sender: Any?) { focusSearch() }
}
