import AppKit

@MainActor
final class TabStripView: NSView {
    var onSelect: ((String) -> Void)?
    var onClose: ((String) -> Void)?
    var onTogglePin: ((String) -> Void)?

    private let stack = NSStackView()
    private let scrollView = NSScrollView()

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        stack.orientation = .horizontal
        stack.spacing = 3
        stack.alignment = .centerY
        stack.edgeInsets = NSEdgeInsets(top: 4, left: 6, bottom: 4, right: 6)

        scrollView.documentView = stack
        scrollView.hasHorizontalScroller = false
        scrollView.hasVerticalScroller = false
        scrollView.drawsBackground = false
        scrollView.horizontalScrollElasticity = .automatic
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(scrollView)
        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.heightAnchor.constraint(equalTo: scrollView.contentView.heightAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func reload(tabs: [TabRecord], pages: [PageRecord], activePageID: String?) {
        stack.arrangedSubviews.forEach { view in
            stack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        let pageMap = Dictionary(uniqueKeysWithValues: pages.map { ($0.id, $0) })
        for tab in tabs {
            guard let page = pageMap[tab.pageID], page.trashedAt == nil else { continue }
            let container = makeTab(page: page, tab: tab, active: tab.pageID == activePageID)
            stack.addArrangedSubview(container)
        }
    }

    private func makeTab(page: PageRecord, tab: TabRecord, active: Bool) -> NSView {
        let container = NSView()
        container.wantsLayer = true
        container.layer?.cornerRadius = DesignTokens.Radius.small
        container.layer?.backgroundColor = active
            ? DesignTokens.Color.surfaceRaised.cgColor
            : NSColor.clear.cgColor

        let select = TabButton(title: page.displayTitle, target: self, action: #selector(selectTab(_:)))
        select.pageID = page.id
        select.isBordered = false
        select.bezelStyle = .inline
        select.font = tab.isPreview
            ? .systemFont(ofSize: 12.5).withTraits(.italic)
            : .systemFont(ofSize: 12.5, weight: active ? .medium : .regular)
        select.contentTintColor = DesignTokens.Color.textPrimary
        select.toolTip = page.displayTitle
        select.setAccessibilityLabel(tab.isPreview ? "\(page.displayTitle)，预览标签" : page.displayTitle)

        let close = TabButton(title: "", target: self, action: #selector(closeTab(_:)))
        close.pageID = page.id
        close.isBordered = false
        close.image = NSImage(systemSymbolName: tab.isPinned ? "pin.fill" : "xmark", accessibilityDescription: tab.isPinned ? "已固定" : "关闭")
        close.image?.isTemplate = true
        close.toolTip = tab.isPinned ? "取消固定标签" : "关闭标签"
        close.contentTintColor = DesignTokens.Color.textSecondary

        let menu = NSMenu()
        let pinItem = menu.addItem(withTitle: tab.isPinned ? "取消固定" : "固定标签", action: #selector(togglePin(_:)), keyEquivalent: "")
        pinItem.target = self
        pinItem.representedObject = page.id
        let closeItem = menu.addItem(withTitle: "关闭标签", action: #selector(closeMenuTab(_:)), keyEquivalent: "")
        closeItem.target = self
        closeItem.representedObject = page.id
        container.menu = menu

        for view in [select, close] {
            view.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(view)
        }
        NSLayoutConstraint.activate([
            select.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 8),
            select.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            select.widthAnchor.constraint(lessThanOrEqualToConstant: 170),
            close.leadingAnchor.constraint(equalTo: select.trailingAnchor, constant: 2),
            close.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -5),
            close.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            close.widthAnchor.constraint(equalToConstant: 18),
            container.heightAnchor.constraint(equalToConstant: 28),
        ])
        return container
    }

    @objc private func selectTab(_ sender: TabButton) {
        if let pageID = sender.pageID { onSelect?(pageID) }
    }

    @objc private func closeTab(_ sender: TabButton) {
        guard let pageID = sender.pageID else { return }
        if sender.toolTip == "取消固定标签" { onTogglePin?(pageID) }
        else { onClose?(pageID) }
    }

    @objc private func togglePin(_ sender: NSMenuItem) {
        if let pageID = sender.representedObject as? String { onTogglePin?(pageID) }
    }

    @objc private func closeMenuTab(_ sender: NSMenuItem) {
        if let pageID = sender.representedObject as? String { onClose?(pageID) }
    }
}

private final class TabButton: NSButton {
    var pageID: String?
}

private extension NSFont {
    func withTraits(_ traits: NSFontDescriptor.SymbolicTraits) -> NSFont {
        let descriptor = fontDescriptor.withSymbolicTraits(traits)
        return NSFont(descriptor: descriptor, size: pointSize) ?? self
    }
}
