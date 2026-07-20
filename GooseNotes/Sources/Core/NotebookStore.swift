import AppKit
import Foundation

extension Notification.Name {
    static let libraryDidChange = Notification.Name("GooseNotes.libraryDidChange")
    static let saveStateDidChange = Notification.Name("GooseNotes.saveStateDidChange")
}

enum PageMovePosition {
    case before
    case inside
    case after
}

@MainActor
final class NotebookStore {
    private(set) var document: LibraryDocument
    private(set) var saveState: SaveState = .idle {
        didSet {
            guard oldValue != saveState else { return }
            NotificationCenter.default.post(name: .saveStateDidChange, object: self)
        }
    }
    private(set) var lastLoadError: Error?
    weak var undoManager: UndoManager?

    private let repository: LibraryRepository
    private var saveGeneration = 0

    init(repository: LibraryRepository, document: LibraryDocument = .empty()) {
        self.repository = repository
        self.document = document
    }

    func load() async {
        do {
            document = try await repository.load()
            lastLoadError = nil
        } catch {
            document = .empty()
            lastLoadError = error
        }
        document.normalize()
        notifyLibraryChanged()
    }

    var activeNotebook: NotebookRecord? {
        document.activeNotebookID.flatMap(document.notebook(id:))
    }

    var activePage: PageRecord? {
        document.activePageID.flatMap(document.page(for:))
    }

    func page(id: String) -> PageRecord? {
        document.page(for: id)
    }

    func notebooks() -> [NotebookRecord] {
        document.notebooks.sorted {
            if $0.order == $1.order { return $0.createdAt < $1.createdAt }
            return $0.order < $1.order
        }
    }

    func pages(filter: LibraryFilter, query: String = "") -> [PageRecord] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines).localizedLowercase
        return document.pages
            .filter { page in
                switch filter {
                case .all:
                    guard page.trashedAt == nil,
                          page.notebookID == document.activeNotebookID else { return false }
                case .favorites:
                    guard page.trashedAt == nil, page.isFavorite else { return false }
                case .trash:
                    guard page.trashedAt != nil else { return false }
                }
                guard !normalizedQuery.isEmpty else { return true }
                return page.displayTitle.localizedLowercase.contains(normalizedQuery)
                    || searchableText(in: page.content).localizedLowercase.contains(normalizedQuery)
            }
            .sorted {
                if filter == .trash {
                    return ($0.trashedAt ?? .distantPast) > ($1.trashedAt ?? .distantPast)
                }
                if $0.order == $1.order { return $0.updatedAt > $1.updatedAt }
                return $0.order < $1.order
            }
    }

    @discardableResult
    func createNotebook(name: String = "新笔记本") -> NotebookRecord {
        let before = document
        let now = Date()
        let notebook = NotebookRecord(
            id: UUID().uuidString.lowercased(),
            name: uniqueNotebookName(base: name),
            icon: "folder",
            order: (document.notebooks.map(\.order).max() ?? -1) + 1,
            createdAt: now,
            updatedAt: now
        )
        document.notebooks.append(notebook)
        document.activeNotebookID = notebook.id
        document.activePageID = nil
        finishStructuralMutation(before: before, actionName: "新建笔记本")
        return notebook
    }

    func renameNotebook(id: String, name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let index = document.notebooks.firstIndex(where: { $0.id == id }) else { return }
        let before = document
        document.notebooks[index].name = trimmed
        document.notebooks[index].updatedAt = Date()
        finishStructuralMutation(before: before, actionName: "重命名笔记本")
    }

    func deleteNotebook(id: String) {
        guard document.notebooks.count > 1,
              document.notebooks.contains(where: { $0.id == id }) else { return }
        let before = document
        let removedPageIDs = Set(document.pages.filter { $0.notebookID == id }.map(\.id))
        document.notebooks.removeAll { $0.id == id }
        document.pages.removeAll { $0.notebookID == id }
        document.tabs.removeAll { removedPageIDs.contains($0.pageID) }
        if document.activeNotebookID == id {
            document.activeNotebookID = notebooks().first?.id
        }
        if document.activePageID.map(removedPageIDs.contains) == true {
            document.activePageID = document.tabs.last?.pageID
        }
        finishStructuralMutation(before: before, actionName: "删除笔记本")
    }

    func selectNotebook(id: String) {
        guard document.notebook(id: id) != nil else { return }
        document.activeNotebookID = id
        let visibleTab = document.tabs
            .reversed()
            .first { document.page(for: $0.pageID)?.notebookID == id }
        document.activePageID = visibleTab?.pageID
        notifyLibraryChanged()
        schedulePersistence()
    }

    @discardableResult
    func createPage(parentID: String? = nil, title: String = "") -> PageRecord? {
        guard let notebookID = document.activeNotebookID else { return nil }
        let before = document
        let now = Date()
        let siblingOrders = document.pages
            .filter { $0.notebookID == notebookID && $0.parentID == parentID }
            .map(\.order)
        let page = PageRecord(
            id: UUID().uuidString.lowercased(),
            notebookID: notebookID,
            parentID: parentID,
            title: title,
            icon: "document",
            content: [],
            order: (siblingOrders.max() ?? -1) + 1,
            isFavorite: false,
            trashedAt: nil,
            revision: 0,
            createdAt: now,
            updatedAt: now
        )
        document.pages.append(page)
        openPage(id: page.id, permanent: true, persist: false)
        finishStructuralMutation(before: before, actionName: "新建页面")
        return page
    }

    func openPage(id: String, permanent: Bool, persist: Bool = true) {
        guard let page = document.page(for: id), page.trashedAt == nil else { return }
        document.activeNotebookID = page.notebookID
        document.activePageID = id
        let now = Date()
        if let index = document.tabs.firstIndex(where: { $0.pageID == id }) {
            document.tabs[index].lastAccessedAt = now
            if permanent { document.tabs[index].isPreview = false }
        } else if permanent {
            document.tabs.append(TabRecord(pageID: id, isPinned: false, isPreview: false, lastAccessedAt: now))
        } else if let previewIndex = document.tabs.firstIndex(where: { $0.isPreview && !$0.isPinned }) {
            document.tabs[previewIndex] = TabRecord(pageID: id, isPinned: false, isPreview: true, lastAccessedAt: now)
        } else {
            document.tabs.append(TabRecord(pageID: id, isPinned: false, isPreview: true, lastAccessedAt: now))
        }
        notifyLibraryChanged()
        if persist { schedulePersistence() }
    }

    func promoteActivePreview() {
        guard let activeID = document.activePageID,
              let index = document.tabs.firstIndex(where: { $0.pageID == activeID }),
              document.tabs[index].isPreview else { return }
        document.tabs[index].isPreview = false
        notifyLibraryChanged()
        schedulePersistence()
    }

    func closeTab(pageID: String) {
        guard let index = document.tabs.firstIndex(where: { $0.pageID == pageID }) else { return }
        document.tabs.remove(at: index)
        if document.activePageID == pageID {
            let next = document.tabs.indices.contains(index) ? document.tabs[index] : document.tabs.last
            document.activePageID = next?.pageID
            if let page = next.flatMap({ document.page(for: $0.pageID) }) {
                document.activeNotebookID = page.notebookID
            }
        }
        notifyLibraryChanged()
        schedulePersistence()
    }

    func toggleTabPinned(pageID: String) {
        guard let index = document.tabs.firstIndex(where: { $0.pageID == pageID }) else { return }
        document.tabs[index].isPinned.toggle()
        if document.tabs[index].isPinned { document.tabs[index].isPreview = false }
        notifyLibraryChanged()
        schedulePersistence()
    }

    func renamePage(id: String, title: String) {
        guard let index = document.pages.firstIndex(where: { $0.id == id }) else { return }
        let before = document
        document.pages[index].title = title
        document.pages[index].revision += 1
        document.pages[index].updatedAt = Date()
        finishStructuralMutation(before: before, actionName: "重命名页面")
    }

    func toggleFavorite(id: String) {
        guard let index = document.pages.firstIndex(where: { $0.id == id }) else { return }
        let before = document
        document.pages[index].isFavorite.toggle()
        document.pages[index].updatedAt = Date()
        finishStructuralMutation(before: before, actionName: document.pages[index].isFavorite ? "收藏页面" : "取消收藏")
    }

    func trashPage(id: String) {
        guard let index = document.pages.firstIndex(where: { $0.id == id }),
              document.pages[index].trashedAt == nil else { return }
        let before = document
        let affected = descendantIDs(of: id).union([id])
        let now = Date()
        for pageIndex in document.pages.indices where affected.contains(document.pages[pageIndex].id) {
            document.pages[pageIndex].trashedAt = now
            document.pages[pageIndex].isFavorite = false
            document.pages[pageIndex].updatedAt = now
        }
        document.tabs.removeAll { affected.contains($0.pageID) }
        if document.activePageID.map(affected.contains) == true {
            document.activePageID = document.tabs.last?.pageID
        }
        finishStructuralMutation(before: before, actionName: "移到回收站")
    }

    func restorePage(id: String) {
        guard let index = document.pages.firstIndex(where: { $0.id == id }),
              document.pages[index].trashedAt != nil else { return }
        let before = document
        document.pages[index].trashedAt = nil
        if let parentID = document.pages[index].parentID,
           document.page(for: parentID)?.trashedAt != nil {
            document.pages[index].parentID = nil
        }
        document.pages[index].updatedAt = Date()
        document.activeNotebookID = document.pages[index].notebookID
        openPage(id: id, permanent: true, persist: false)
        finishStructuralMutation(before: before, actionName: "恢复页面")
    }

    func permanentlyDeletePage(id: String) {
        guard document.page(for: id)?.trashedAt != nil else { return }
        let before = document
        let affected = descendantIDs(of: id).union([id])
        document.pages.removeAll { affected.contains($0.id) }
        document.tabs.removeAll { affected.contains($0.pageID) }
        if document.activePageID.map(affected.contains) == true {
            document.activePageID = document.tabs.last?.pageID
        }
        finishStructuralMutation(before: before, actionName: "彻底删除页面")
    }

    func movePage(id: String, relativeTo targetID: String, position: PageMovePosition) {
        guard id != targetID,
              let source = document.page(for: id),
              let target = document.page(for: targetID),
              source.notebookID == target.notebookID,
              !descendantIDs(of: id).contains(targetID),
              let sourceIndex = document.pages.firstIndex(where: { $0.id == id }) else { return }
        let before = document

        let newParentID: String?
        switch position {
        case .inside: newParentID = targetID
        case .before, .after: newParentID = target.parentID
        }
        document.pages[sourceIndex].parentID = newParentID

        var siblings = document.pages
            .filter { $0.notebookID == source.notebookID && $0.parentID == newParentID && $0.id != id }
            .sorted { $0.order < $1.order }
        let targetIndex = siblings.firstIndex(where: { $0.id == targetID })
        let insertionIndex: Int
        switch position {
        case .inside: insertionIndex = siblings.count
        case .before: insertionIndex = targetIndex ?? siblings.count
        case .after: insertionIndex = min((targetIndex ?? siblings.count - 1) + 1, siblings.count)
        }
        siblings.insert(document.pages[sourceIndex], at: max(0, insertionIndex))
        for (order, sibling) in siblings.enumerated() {
            if let pageIndex = document.pages.firstIndex(where: { $0.id == sibling.id }) {
                document.pages[pageIndex].order = order
                document.pages[pageIndex].updatedAt = Date()
            }
        }
        finishStructuralMutation(before: before, actionName: "移动页面")
    }

    func markEditorDirty(pageID: String) {
        guard document.activePageID == pageID,
              document.page(for: pageID)?.trashedAt == nil else { return }
        saveState = .saving
    }

    func applyEditorDraft(_ draft: EditorDraft) async -> SaveAcknowledgement {
        guard draft.version == 1,
              let index = document.pages.firstIndex(where: { $0.id == draft.pageID }) else {
            return SaveAcknowledgement(
                requestID: draft.requestID,
                pageID: draft.pageID,
                revision: draft.baseRevision,
                status: .failed,
                message: "页面不存在或桥接版本不受支持。"
            )
        }
        guard document.activePageID == draft.pageID else {
            return SaveAcknowledgement(
                requestID: draft.requestID,
                pageID: draft.pageID,
                revision: document.pages[index].revision,
                status: .conflict,
                message: "当前页面已切换，请重新载入后继续编辑。"
            )
        }
        guard document.pages[index].revision == draft.baseRevision else {
            return SaveAcknowledgement(
                requestID: draft.requestID,
                pageID: draft.pageID,
                revision: document.pages[index].revision,
                status: .conflict,
                message: "页面已在其他位置更新，请重新载入。"
            )
        }

        let changed = document.pages[index].title != draft.title
            || document.pages[index].icon != draft.icon
            || document.pages[index].content != draft.content
        if changed {
            document.pages[index].title = draft.title
            document.pages[index].icon = draft.icon
            document.pages[index].content = draft.content
            document.pages[index].revision += 1
            document.pages[index].updatedAt = Date()
        }
        let acceptedRevision = document.pages[index].revision
        if changed { promoteActivePreview() }

        if !changed, case .failed = saveState {
            // Retry the last in-memory document even when the editor has no newer changes.
        } else if !changed {
            if case .saving = saveState { saveState = .saved(Date()) }
            return SaveAcknowledgement(
                requestID: draft.requestID,
                pageID: draft.pageID,
                revision: acceptedRevision,
                status: .saved,
                message: nil
            )
        }

        saveState = .saving
        if changed { notifyLibraryChanged() }

        do {
            try await repository.save(document)
            saveState = .saved(Date())
            return SaveAcknowledgement(
                requestID: draft.requestID,
                pageID: draft.pageID,
                revision: acceptedRevision,
                status: .saved,
                message: nil
            )
        } catch {
            saveState = .failed(error.localizedDescription)
            return SaveAcknowledgement(
                requestID: draft.requestID,
                pageID: draft.pageID,
                revision: acceptedRevision,
                status: .failed,
                message: error.localizedDescription
            )
        }
    }

    func flushPersistence() async throws {
        saveState = .saving
        do {
            try await repository.save(document)
            saveState = .saved(Date())
        } catch {
            saveState = .failed(error.localizedDescription)
            throw error
        }
    }

    private func finishStructuralMutation(before: LibraryDocument, actionName: String) {
        document.normalize()
        registerUndo(before: before, actionName: actionName)
        notifyLibraryChanged()
        schedulePersistence()
    }

    private func registerUndo(before: LibraryDocument, actionName: String) {
        undoManager?.registerUndo(withTarget: self) { target in
            let redo = target.document
            target.document = before
            target.document.normalize()
            target.registerUndo(before: redo, actionName: actionName)
            target.notifyLibraryChanged()
            target.schedulePersistence()
        }
        undoManager?.setActionName(actionName)
    }

    private func schedulePersistence() {
        saveGeneration += 1
        let generation = saveGeneration
        let snapshot = document
        saveState = .saving
        Task { [weak self] in
            guard let self else { return }
            do {
                try await repository.save(snapshot)
                guard generation == saveGeneration else { return }
                saveState = .saved(Date())
            } catch {
                guard generation == saveGeneration else { return }
                saveState = .failed(error.localizedDescription)
            }
        }
    }

    private func notifyLibraryChanged() {
        NotificationCenter.default.post(name: .libraryDidChange, object: self)
    }

    private func uniqueNotebookName(base: String) -> String {
        let existing = Set(document.notebooks.map { $0.name.localizedLowercase })
        guard existing.contains(base.localizedLowercase) else { return base }
        var index = 2
        while existing.contains("\(base) \(index)".localizedLowercase) { index += 1 }
        return "\(base) \(index)"
    }

    private func descendantIDs(of pageID: String) -> Set<String> {
        var result: Set<String> = []
        var frontier = [pageID]
        while let parent = frontier.popLast() {
            let children = document.pages.filter { $0.parentID == parent }.map(\.id)
            for child in children where result.insert(child).inserted {
                frontier.append(child)
            }
        }
        return result
    }

    private func searchableText(in values: [JSONValue]) -> String {
        values.flatMap(searchableStrings(in:)).joined(separator: " ")
    }

    private func searchableStrings(in value: JSONValue) -> [String] {
        switch value {
        case .string(let string): return [string]
        case .array(let array): return array.flatMap(searchableStrings(in:))
        case .object(let object):
            if case .string(let text)? = object["text"] { return [text] }
            return object.values.flatMap(searchableStrings(in:))
        case .number, .bool, .null: return []
        }
    }
}
