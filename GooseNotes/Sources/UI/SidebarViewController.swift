import AppKit

@MainActor
final class SidebarNode: NSObject {
    let pageID: String
    init(pageID: String) { self.pageID = pageID }
}

@MainActor
final class SidebarViewController: NSViewController, NSOutlineViewDataSource, NSOutlineViewDelegate,
    NSSearchFieldDelegate, NSMenuDelegate {

    var onSelectPage: ((String, Bool) -> Void)?
    var onCreatePage: ((String?) -> Void)?
    var onCreateNotebook: (() -> Void)?
    var onSelectNotebook: ((String) -> Void)?
    var onRenamePage: ((String, String) -> Void)?
    var onToggleFavorite: ((String) -> Void)?
    var onTrashPage: ((String) -> Void)?
    var onRestorePage: ((String) -> Void)?
    var onDeletePermanently: ((String) -> Void)?
    var onMovePage: ((String, String, PageMovePosition) -> Void)?

    private let store: NotebookStore
    private let notebookPopup = NSPopUpButton()
    private let addNotebookButton = NSButton()
    private let searchField = NSSearchField()
    private let filterControl = NSSegmentedControl(labels: ["页面", "收藏", "回收站"], trackingMode: .selectOne, target: nil, action: nil)
    private let outlineView = NSOutlineView()
    private let scrollView = NSScrollView()
    private let emptyLabel = NSTextField(labelWithString: "")
    private let addPageButton = NSButton()
    private var filter: LibraryFilter = .all
    private var nodesByID: [String: SidebarNode] = [:]
    private var visiblePageIDs: Set<String> = []
    private let observerTokens = NotificationTokenBag()

    init(store: NotebookStore) {
        self.store = store
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func loadView() {
        let root = NSView()
        root.wantsLayer = true
        root.layer?.backgroundColor = DesignTokens.Color.sidebar.cgColor
        view = root

        notebookPopup.controlSize = .large
        notebookPopup.font = .systemFont(ofSize: 14, weight: .semibold)
        notebookPopup.target = self
        notebookPopup.action = #selector(notebookChanged(_:))
        notebookPopup.setAccessibilityLabel("当前笔记本")

        addNotebookButton.bezelStyle = .accessoryBarAction
        addNotebookButton.image = NSImage(systemSymbolName: "folder.badge.plus", accessibilityDescription: "新建笔记本")
        addNotebookButton.target = self
        addNotebookButton.action = #selector(createNotebook(_:))
        addNotebookButton.toolTip = "新建笔记本"

        searchField.placeholderString = "搜索所有笔记"
        searchField.sendsSearchStringImmediately = true
        searchField.delegate = self
        searchField.setAccessibilityLabel("搜索笔记")

        filterControl.selectedSegment = 0
        filterControl.segmentStyle = .automatic
        filterControl.target = self
        filterControl.action = #selector(filterChanged(_:))
        filterControl.setAccessibilityLabel("页面筛选")

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("page"))
        column.resizingMask = .autoresizingMask
        outlineView.addTableColumn(column)
        outlineView.outlineTableColumn = column
        outlineView.headerView = nil
        outlineView.rowHeight = 30
        outlineView.indentationPerLevel = 15
        outlineView.usesAlternatingRowBackgroundColors = false
        outlineView.style = .sourceList
        outlineView.dataSource = self
        outlineView.delegate = self
        outlineView.target = self
        outlineView.doubleAction = #selector(openPermanently(_:))
        outlineView.setAccessibilityLabel("页面树")
        outlineView.registerForDraggedTypes([.string])

        let menu = NSMenu()
        menu.delegate = self
        outlineView.menu = menu

        scrollView.documentView = outlineView
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.drawsBackground = false

        emptyLabel.alignment = .center
        emptyLabel.textColor = DesignTokens.Color.textSecondary
        emptyLabel.font = .systemFont(ofSize: 13)
        emptyLabel.maximumNumberOfLines = 3
        emptyLabel.lineBreakMode = .byWordWrapping
        emptyLabel.isHidden = true

        addPageButton.title = "新建页面"
        addPageButton.image = NSImage(systemSymbolName: "square.and.pencil", accessibilityDescription: nil)
        addPageButton.imagePosition = .imageLeading
        addPageButton.bezelStyle = .recessed
        addPageButton.target = self
        addPageButton.action = #selector(createPage(_:))
        addPageButton.toolTip = "新建页面（⌘N）"

        let header = NSStackView(views: [notebookPopup, addNotebookButton])
        header.orientation = .horizontal
        header.alignment = .centerY
        header.spacing = DesignTokens.Space.sm
        notebookPopup.setContentHuggingPriority(.defaultLow, for: .horizontal)
        addNotebookButton.setContentHuggingPriority(.required, for: .horizontal)

        for item in [header, searchField, filterControl, scrollView, emptyLabel, addPageButton] {
            item.translatesAutoresizingMaskIntoConstraints = false
            root.addSubview(item)
        }

        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor, constant: DesignTokens.Space.md),
            header.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: DesignTokens.Space.md),
            header.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -DesignTokens.Space.md),
            notebookPopup.widthAnchor.constraint(greaterThanOrEqualToConstant: 140),

            searchField.topAnchor.constraint(equalTo: header.bottomAnchor, constant: DesignTokens.Space.md),
            searchField.leadingAnchor.constraint(equalTo: header.leadingAnchor),
            searchField.trailingAnchor.constraint(equalTo: header.trailingAnchor),

            filterControl.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: DesignTokens.Space.sm),
            filterControl.leadingAnchor.constraint(equalTo: header.leadingAnchor),
            filterControl.trailingAnchor.constraint(equalTo: header.trailingAnchor),

            scrollView.topAnchor.constraint(equalTo: filterControl.bottomAnchor, constant: DesignTokens.Space.sm),
            scrollView.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: DesignTokens.Space.xs),
            scrollView.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -DesignTokens.Space.xs),
            scrollView.bottomAnchor.constraint(equalTo: addPageButton.topAnchor, constant: -DesignTokens.Space.sm),

            emptyLabel.centerXAnchor.constraint(equalTo: scrollView.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: scrollView.centerYAnchor),
            emptyLabel.widthAnchor.constraint(lessThanOrEqualTo: scrollView.widthAnchor, constant: -36),

            addPageButton.leadingAnchor.constraint(equalTo: header.leadingAnchor),
            addPageButton.trailingAnchor.constraint(equalTo: header.trailingAnchor),
            addPageButton.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.bottomAnchor, constant: -DesignTokens.Space.md),
            addPageButton.heightAnchor.constraint(equalToConstant: 30),
        ])
        observerTokens.values.append(NotificationCenter.default.addObserver(
            forName: .libraryDidChange, object: store, queue: .main
        ) { [weak self] _ in Task { @MainActor in self?.reload() } })
        reload()
    }

    func focusSearch() {
        view.window?.makeFirstResponder(searchField)
        searchField.selectText(nil)
    }

    func reload() {
        guard isViewLoaded else { return }
        let selectedNotebook = store.document.activeNotebookID
        notebookPopup.removeAllItems()
        for notebook in store.notebooks() {
            notebookPopup.addItem(withTitle: notebook.name)
            notebookPopup.lastItem?.representedObject = notebook.id
        }
        if let selectedNotebook,
           let index = notebookPopup.itemArray.firstIndex(where: { ($0.representedObject as? String) == selectedNotebook }) {
            notebookPopup.selectItem(at: index)
        }

        rebuildNodes()
        outlineView.reloadData()
        restoreExpansionState()
        if let activeID = store.document.activePageID, let node = nodesByID[activeID] {
            let row = outlineView.row(forItem: node)
            if row >= 0 { outlineView.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false) }
        }
        updateEmptyState()
    }

    func selectedPageID() -> String? {
        guard outlineView.selectedRow >= 0,
              let node = outlineView.item(atRow: outlineView.selectedRow) as? SidebarNode else { return nil }
        return node.pageID
    }

    func outlineView(_ outlineView: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int {
        children(of: item as? SidebarNode).count
    }

    func outlineView(_ outlineView: NSOutlineView, child index: Int, ofItem item: Any?) -> Any {
        children(of: item as? SidebarNode)[index]
    }

    func outlineView(_ outlineView: NSOutlineView, isItemExpandable item: Any) -> Bool {
        guard filter == .all, searchField.stringValue.isEmpty, let node = item as? SidebarNode else { return false }
        return children(of: node).isEmpty == false
    }

    func outlineView(_ outlineView: NSOutlineView, viewFor tableColumn: NSTableColumn?, item: Any) -> NSView? {
        guard let node = item as? SidebarNode, let page = store.page(id: node.pageID) else { return nil }
        let identifier = NSUserInterfaceItemIdentifier("PageCell")
        let cell = (outlineView.makeView(withIdentifier: identifier, owner: self) as? NSTableCellView) ?? makePageCell(identifier: identifier)
        cell.textField?.stringValue = page.displayTitle
        cell.textField?.font = page.id == store.document.activePageID
            ? .systemFont(ofSize: 13, weight: .medium)
            : .systemFont(ofSize: 13)
        cell.textField?.textColor = DesignTokens.Color.textPrimary
        let symbol = page.isFavorite ? "star.fill" : "doc.text"
        let image = NSImage(systemSymbolName: symbol, accessibilityDescription: page.isFavorite ? "已收藏" : "页面")
        image?.isTemplate = true
        cell.imageView?.image = image
        return cell
    }

    func outlineViewSelectionDidChange(_ notification: Notification) {
        guard let pageID = selectedPageID() else { return }
        onSelectPage?(pageID, false)
    }

    func outlineView(_ outlineView: NSOutlineView, shouldEdit tableColumn: NSTableColumn?, item: Any) -> Bool {
        filter != .trash
    }

    func control(_ control: NSControl, textShouldEndEditing fieldEditor: NSText) -> Bool {
        guard control !== searchField,
              let pageID = selectedPageID() else { return true }
        let title = fieldEditor.string.trimmingCharacters(in: .whitespacesAndNewlines)
        onRenamePage?(pageID, title)
        return true
    }

    func controlTextDidChange(_ obj: Notification) {
        guard obj.object as? NSSearchField === searchField else { return }
        reload()
    }

    func outlineView(_ outlineView: NSOutlineView, pasteboardWriterForItem item: Any) -> NSPasteboardWriting? {
        guard filter == .all, let node = item as? SidebarNode else { return nil }
        return node.pageID as NSString
    }

    func outlineView(
        _ outlineView: NSOutlineView,
        validateDrop info: NSDraggingInfo,
        proposedItem item: Any?,
        proposedChildIndex index: Int
    ) -> NSDragOperation {
        guard filter == .all,
              index == NSOutlineViewDropOnItemIndex,
              item is SidebarNode else { return [] }
        return .move
    }

    func outlineView(
        _ outlineView: NSOutlineView,
        acceptDrop info: NSDraggingInfo,
        item: Any?,
        childIndex index: Int
    ) -> Bool {
        guard let sourceID = info.draggingPasteboard.string(forType: .string),
              let target = item as? SidebarNode else { return false }
        onMovePage?(sourceID, target.pageID, .inside)
        return true
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        guard outlineView.clickedRow >= 0,
              let node = outlineView.item(atRow: outlineView.clickedRow) as? SidebarNode,
              let page = store.page(id: node.pageID) else { return }
        outlineView.selectRowIndexes(IndexSet(integer: outlineView.clickedRow), byExtendingSelection: false)

        if page.trashedAt == nil {
            menu.addItem(withTitle: "在固定标签中打开", action: #selector(openPermanently(_:)), keyEquivalent: "")
            menu.addItem(withTitle: "新建子页面", action: #selector(createChildPage(_:)), keyEquivalent: "")
            menu.addItem(withTitle: "重命名", action: #selector(beginRename(_:)), keyEquivalent: "")
            menu.addItem(withTitle: page.isFavorite ? "取消收藏" : "收藏", action: #selector(toggleFavorite(_:)), keyEquivalent: "")
            menu.addItem(.separator())
            let trash = menu.addItem(withTitle: "移到回收站", action: #selector(trashPage(_:)), keyEquivalent: "")
            trash.attributedTitle = NSAttributedString(string: trash.title, attributes: [.foregroundColor: DesignTokens.Color.destructive])
        } else {
            menu.addItem(withTitle: "恢复", action: #selector(restorePage(_:)), keyEquivalent: "")
            let delete = menu.addItem(withTitle: "彻底删除…", action: #selector(deletePermanently(_:)), keyEquivalent: "")
            delete.attributedTitle = NSAttributedString(string: delete.title, attributes: [.foregroundColor: DesignTokens.Color.destructive])
        }
        for item in menu.items where item.action != nil { item.target = self }
    }

    @objc private func notebookChanged(_ sender: NSPopUpButton) {
        guard let id = sender.selectedItem?.representedObject as? String else { return }
        onSelectNotebook?(id)
    }

    @objc private func createNotebook(_ sender: Any?) { onCreateNotebook?() }
    @objc private func createPage(_ sender: Any?) { onCreatePage?(nil) }
    @objc private func createChildPage(_ sender: Any?) {
        guard let pageID = selectedPageID() else { return }
        onCreatePage?(pageID)
    }

    @objc private func openPermanently(_ sender: Any?) {
        guard let pageID = selectedPageID() else { return }
        onSelectPage?(pageID, true)
    }

    @objc private func beginRename(_ sender: Any?) {
        let row = outlineView.selectedRow
        guard row >= 0 else { return }
        outlineView.editColumn(0, row: row, with: nil, select: true)
    }

    @objc private func toggleFavorite(_ sender: Any?) {
        guard let pageID = selectedPageID() else { return }
        onToggleFavorite?(pageID)
    }

    @objc private func trashPage(_ sender: Any?) {
        guard let pageID = selectedPageID() else { return }
        onTrashPage?(pageID)
    }

    @objc private func restorePage(_ sender: Any?) {
        guard let pageID = selectedPageID() else { return }
        onRestorePage?(pageID)
    }

    @objc private func deletePermanently(_ sender: Any?) {
        guard let pageID = selectedPageID() else { return }
        onDeletePermanently?(pageID)
    }

    @objc private func filterChanged(_ sender: NSSegmentedControl) {
        filter = switch sender.selectedSegment {
        case 1: .favorites
        case 2: .trash
        default: .all
        }
        reload()
    }

    private func makePageCell(identifier: NSUserInterfaceItemIdentifier) -> NSTableCellView {
        let cell = NSTableCellView()
        cell.identifier = identifier
        let imageView = NSImageView()
        imageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 13, weight: .regular)
        imageView.contentTintColor = DesignTokens.Color.textSecondary
        let label = NSTextField(labelWithString: "")
        label.lineBreakMode = .byTruncatingTail
        label.isEditable = true
        label.isSelectable = true
        label.delegate = self
        cell.imageView = imageView
        cell.textField = label
        for subview in [imageView, label] {
            subview.translatesAutoresizingMaskIntoConstraints = false
            cell.addSubview(subview)
        }
        NSLayoutConstraint.activate([
            imageView.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 3),
            imageView.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            imageView.widthAnchor.constraint(equalToConstant: 16),
            label.leadingAnchor.constraint(equalTo: imageView.trailingAnchor, constant: 6),
            label.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -6),
            label.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
        ])
        return cell
    }

    private func rebuildNodes() {
        let pages = store.pages(filter: filter, query: searchField.stringValue)
        visiblePageIDs = Set(pages.map(\.id))
        nodesByID = Dictionary(uniqueKeysWithValues: pages.map { ($0.id, SidebarNode(pageID: $0.id)) })
    }

    private func children(of parent: SidebarNode?) -> [SidebarNode] {
        let pages = store.pages(filter: filter, query: searchField.stringValue)
        if filter != .all || !searchField.stringValue.isEmpty {
            return parent == nil ? pages.compactMap { nodesByID[$0.id] } : []
        }
        return pages
            .filter { $0.parentID == parent?.pageID }
            .compactMap { nodesByID[$0.id] }
    }

    private func restoreExpansionState() {
        guard filter == .all, searchField.stringValue.isEmpty else {
            outlineView.expandItem(nil, expandChildren: true)
            return
        }
        for pageID in visiblePageIDs {
            guard let node = nodesByID[pageID], children(of: node).isEmpty == false else { continue }
            outlineView.expandItem(node)
        }
    }

    private func updateEmptyState() {
        let isEmpty = visiblePageIDs.isEmpty
        emptyLabel.isHidden = !isEmpty
        scrollView.isHidden = isEmpty
        switch filter {
        case .all:
            emptyLabel.stringValue = searchField.stringValue.isEmpty
                ? "还没有页面\n点击下方“新建页面”开始写作"
                : "没有找到匹配的笔记"
        case .favorites: emptyLabel.stringValue = "还没有收藏的页面"
        case .trash: emptyLabel.stringValue = "回收站是空的"
        }
        addPageButton.isHidden = filter != .all
    }
}
