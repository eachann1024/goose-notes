import Foundation

enum TestFixtures {
    static let date = Date(timeIntervalSince1970: 1_700_000_000)

    static func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("GooseNotesTests-\(UUID().uuidString)", isDirectory: true)
    }

    static func notebook(id: String = "notebook", order: Int = 0) -> NotebookRecord {
        NotebookRecord(
            id: id,
            name: "测试笔记本",
            icon: "folder",
            order: order,
            createdAt: date,
            updatedAt: date
        )
    }

    static func page(
        id: String,
        notebookID: String,
        parentID: String? = nil,
        order: Int,
        trashedAt: Date? = nil
    ) -> PageRecord {
        PageRecord(
            id: id,
            notebookID: notebookID,
            parentID: parentID,
            title: "测试页面",
            icon: "document",
            content: [],
            order: order,
            isFavorite: false,
            trashedAt: trashedAt,
            revision: 0,
            createdAt: date,
            updatedAt: date
        )
    }

    static func document(pageIDs: [String]) -> LibraryDocument {
        let notebook = notebook()
        let pages = pageIDs.enumerated().map { index, id in
            var page = page(id: id, notebookID: notebook.id, order: index)
            page.title = "页面 \(index + 1)"
            return page
        }
        return LibraryDocument(
            version: LibraryDocument.currentVersion,
            notebooks: [notebook],
            pages: pages,
            tabs: [],
            activeNotebookID: notebook.id,
            activePageID: pageIDs.first
        )
    }

    static func draft(
        pageID: String,
        baseRevision: Int,
        title: String,
        icon: String = "document",
        content: [JSONValue]
    ) -> EditorDraft {
        EditorDraft(
            version: 1,
            requestID: UUID().uuidString,
            pageID: pageID,
            baseRevision: baseRevision,
            title: title,
            icon: icon,
            content: content
        )
    }
}
