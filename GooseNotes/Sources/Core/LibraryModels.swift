import Foundation

struct NotebookRecord: Codable, Equatable, Identifiable, Sendable {
    let id: String
    var name: String
    var icon: String
    var order: Int
    let createdAt: Date
    var updatedAt: Date
}

struct PageRecord: Codable, Equatable, Identifiable, Sendable {
    let id: String
    var notebookID: String
    var parentID: String?
    var title: String
    var icon: String
    var content: [JSONValue]
    var order: Int
    var isFavorite: Bool
    var trashedAt: Date?
    var revision: Int
    let createdAt: Date
    var updatedAt: Date

    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "未命名" : trimmed
    }
}

struct TabRecord: Codable, Equatable, Sendable {
    var pageID: String
    var isPinned: Bool
    var isPreview: Bool
    var lastAccessedAt: Date
}

struct LibraryDocument: Codable, Equatable, Sendable {
    static let currentVersion = 1

    var version: Int
    var notebooks: [NotebookRecord]
    var pages: [PageRecord]
    var tabs: [TabRecord]
    var activeNotebookID: String?
    var activePageID: String?

    static func empty(now: Date = Date()) -> LibraryDocument {
        let notebook = NotebookRecord(
            id: UUID().uuidString.lowercased(),
            name: "我的笔记",
            icon: "folder",
            order: 0,
            createdAt: now,
            updatedAt: now
        )
        return LibraryDocument(
            version: currentVersion,
            notebooks: [notebook],
            pages: [],
            tabs: [],
            activeNotebookID: notebook.id,
            activePageID: nil
        )
    }

    mutating func normalize() {
        version = Self.currentVersion
        if notebooks.isEmpty {
            self = Self.empty()
            return
        }

        let notebookIDs = Set(notebooks.map(\.id))
        pages.removeAll { !notebookIDs.contains($0.notebookID) }
        let pageIDs = Set(pages.map(\.id))
        pages = pages.map { page in
            var page = page
            if let parentID = page.parentID,
               parentID == page.id || !pageIDs.contains(parentID) {
                page.parentID = nil
            }
            return page
        }
        let trashedPageIDs = Set(pages.lazy.filter { $0.trashedAt != nil }.map(\.id))
        tabs.removeAll { !pageIDs.contains($0.pageID) || trashedPageIDs.contains($0.pageID) }
        if activeNotebookID.flatMap({ notebook(id: $0) }) == nil {
            activeNotebookID = notebooks.sorted { $0.order < $1.order }.first?.id
        }
        if activePageID.flatMap({ page(for: $0) })?.trashedAt != nil || activePageID.flatMap({ page(for: $0) }) == nil {
            activePageID = tabs.last?.pageID
        }
    }

    func notebook(id: String) -> NotebookRecord? {
        notebooks.first { $0.id == id }
    }

    func page(for id: String) -> PageRecord? {
        pages.first { $0.id == id }
    }

    func pages(in notebookID: String, includeTrash: Bool = false) -> [PageRecord] {
        pages
            .filter { $0.notebookID == notebookID && (includeTrash || $0.trashedAt == nil) }
            .sorted {
                if $0.order == $1.order { return $0.createdAt < $1.createdAt }
                return $0.order < $1.order
            }
    }
}

enum LibraryFilter: String, CaseIterable, Sendable {
    case all
    case favorites
    case trash
}

enum SaveState: Equatable, Sendable {
    case idle
    case saving
    case saved(Date)
    case failed(String)
}

struct EditorDraft: Codable, Sendable {
    var version: Int
    var requestID: String
    var pageID: String
    var baseRevision: Int
    var title: String
    var icon: String
    var content: [JSONValue]
}

struct SaveAcknowledgement: Codable, Sendable {
    enum Status: String, Codable, Sendable {
        case saved
        case conflict
        case failed
    }

    var version: Int = 1
    var requestID: String
    var pageID: String
    var revision: Int
    var status: Status
    var message: String?
}
