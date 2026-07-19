import XCTest

final class LibraryDocumentTests: XCTestCase {
    func testNormalizeRepairsInvalidRelationshipsTabsAndSelection() {
        let date = TestFixtures.date
        let firstNotebook = TestFixtures.notebook(id: "notebook-first", order: 0)
        let secondNotebook = TestFixtures.notebook(id: "notebook-second", order: 1)
        let rootPage = TestFixtures.page(id: "root", notebookID: firstNotebook.id, order: 0)
        let selfParentedPage = TestFixtures.page(
            id: "self-parented",
            notebookID: firstNotebook.id,
            parentID: "self-parented",
            order: 1
        )
        let missingParentPage = TestFixtures.page(
            id: "missing-parent",
            notebookID: firstNotebook.id,
            parentID: "does-not-exist",
            order: 2
        )
        let trashedPage = TestFixtures.page(
            id: "trashed",
            notebookID: firstNotebook.id,
            order: 3,
            trashedAt: date
        )
        let orphanedPage = TestFixtures.page(id: "orphaned", notebookID: "missing-notebook", order: 4)

        var document = LibraryDocument(
            version: 0,
            notebooks: [secondNotebook, firstNotebook],
            pages: [rootPage, selfParentedPage, missingParentPage, trashedPage, orphanedPage],
            tabs: [
                TabRecord(pageID: rootPage.id, isPinned: false, isPreview: false, lastAccessedAt: date),
                TabRecord(pageID: orphanedPage.id, isPinned: false, isPreview: true, lastAccessedAt: date),
                TabRecord(pageID: trashedPage.id, isPinned: false, isPreview: true, lastAccessedAt: date),
                TabRecord(pageID: selfParentedPage.id, isPinned: false, isPreview: true, lastAccessedAt: date),
            ],
            activeNotebookID: "missing-notebook",
            activePageID: trashedPage.id
        )

        document.normalize()

        XCTAssertEqual(document.version, LibraryDocument.currentVersion)
        XCTAssertEqual(Set(document.pages.map(\.id)), Set(["root", "self-parented", "missing-parent", "trashed"]))
        XCTAssertNil(document.page(for: selfParentedPage.id)?.parentID)
        XCTAssertNil(document.page(for: missingParentPage.id)?.parentID)
        XCTAssertEqual(document.tabs.map(\.pageID), [rootPage.id, selfParentedPage.id])
        XCTAssertEqual(document.activeNotebookID, firstNotebook.id)
        XCTAssertEqual(document.activePageID, selfParentedPage.id)
    }

    func testNormalizeReplacesACompletelyEmptyNotebookList() {
        var document = LibraryDocument(
            version: 0,
            notebooks: [],
            pages: [TestFixtures.page(id: "orphaned", notebookID: "missing", order: 0)],
            tabs: [TabRecord(pageID: "orphaned", isPinned: true, isPreview: false, lastAccessedAt: TestFixtures.date)],
            activeNotebookID: "missing",
            activePageID: "orphaned"
        )

        document.normalize()

        XCTAssertEqual(document.version, LibraryDocument.currentVersion)
        XCTAssertEqual(document.notebooks.count, 1)
        XCTAssertTrue(document.pages.isEmpty)
        XCTAssertTrue(document.tabs.isEmpty)
        XCTAssertEqual(document.activeNotebookID, document.notebooks.first?.id)
        XCTAssertNil(document.activePageID)
    }
}
