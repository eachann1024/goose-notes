import XCTest

@MainActor
final class NotebookStoreTests: XCTestCase {
    func testPreviewTabIsReusedAndPermanentOrPinnedTabsAreKept() async throws {
        let temporaryDirectory = TestFixtures.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: temporaryDirectory) }

        let repository = try LibraryRepository(directoryURL: temporaryDirectory)
        let document = TestFixtures.document(pageIDs: ["page-one", "page-two", "page-three"])
        let store = NotebookStore(repository: repository, document: document)

        store.openPage(id: "page-one", permanent: false, persist: false)
        XCTAssertEqual(store.document.tabs.map(\.pageID), ["page-one"])
        XCTAssertTrue(store.document.tabs[0].isPreview)

        store.openPage(id: "page-two", permanent: false, persist: false)
        XCTAssertEqual(store.document.tabs.map(\.pageID), ["page-two"])
        XCTAssertTrue(store.document.tabs[0].isPreview)

        store.openPage(id: "page-two", permanent: true, persist: false)
        XCTAssertFalse(store.document.tabs[0].isPreview)

        store.openPage(id: "page-three", permanent: false, persist: false)
        XCTAssertEqual(store.document.tabs.map(\.pageID), ["page-two", "page-three"])
        XCTAssertTrue(store.document.tabs[1].isPreview)

        store.toggleTabPinned(pageID: "page-three")
        XCTAssertTrue(store.document.tabs[1].isPinned)
        XCTAssertFalse(store.document.tabs[1].isPreview)

        store.openPage(id: "page-one", permanent: false, persist: false)
        XCTAssertEqual(store.document.tabs.map(\.pageID), ["page-two", "page-three", "page-one"])
        XCTAssertTrue(store.document.tabs[2].isPreview)
        try await store.flushPersistence()
    }

    func testEditorDraftWithStaleRevisionIsRejectedWithoutMutation() async throws {
        let temporaryDirectory = TestFixtures.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: temporaryDirectory) }

        var document = TestFixtures.document(pageIDs: ["active-page"])
        document.pages[0].revision = 4
        document.pages[0].title = "原始标题"
        document.activePageID = "active-page"
        let store = NotebookStore(
            repository: try LibraryRepository(directoryURL: temporaryDirectory),
            document: document
        )

        let acknowledgement = await store.applyEditorDraft(
            TestFixtures.draft(
                pageID: "active-page",
                baseRevision: 3,
                title: "不应写入",
                content: [.string("不应写入")]
            )
        )

        XCTAssertEqual(acknowledgement.status, .conflict)
        XCTAssertEqual(acknowledgement.revision, 4)
        XCTAssertEqual(store.page(id: "active-page")?.title, "原始标题")
        XCTAssertEqual(store.page(id: "active-page")?.revision, 4)
    }

    func testEditorDraftForInactivePageIsRejectedWithoutMutation() async throws {
        let temporaryDirectory = TestFixtures.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: temporaryDirectory) }

        var document = TestFixtures.document(pageIDs: ["active-page", "inactive-page"])
        document.activePageID = "active-page"
        let store = NotebookStore(
            repository: try LibraryRepository(directoryURL: temporaryDirectory),
            document: document
        )

        let acknowledgement = await store.applyEditorDraft(
            TestFixtures.draft(
                pageID: "inactive-page",
                baseRevision: 0,
                title: "不应写入",
                content: [.string("不应写入")]
            )
        )

        XCTAssertEqual(acknowledgement.status, .conflict)
        XCTAssertEqual(acknowledgement.revision, 0)
        XCTAssertEqual(store.page(id: "inactive-page")?.title, "页面 2")
        XCTAssertEqual(store.page(id: "inactive-page")?.content, [])
    }

    func testUnchangedEditorDraftIsAcknowledgedWithoutIncrementingRevision() async throws {
        let temporaryDirectory = TestFixtures.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: temporaryDirectory) }

        var document = TestFixtures.document(pageIDs: ["active-page"])
        document.pages[0].title = "未变化"
        document.pages[0].icon = "document"
        document.pages[0].content = [.object(["type": .string("paragraph")])]
        document.pages[0].revision = 7
        document.activePageID = "active-page"
        let store = NotebookStore(
            repository: try LibraryRepository(directoryURL: temporaryDirectory),
            document: document
        )

        let acknowledgement = await store.applyEditorDraft(
            TestFixtures.draft(
                pageID: "active-page",
                baseRevision: 7,
                title: "未变化",
                icon: "document",
                content: [.object(["type": .string("paragraph")])]
            )
        )

        XCTAssertEqual(acknowledgement.status, .saved)
        XCTAssertEqual(acknowledgement.revision, 7)
        XCTAssertEqual(store.page(id: "active-page")?.revision, 7)
        XCTAssertEqual(store.saveState, .idle)
    }
}
