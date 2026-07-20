import XCTest

final class LibraryRepositoryTests: XCTestCase {
    func testSaveThenLoadRoundTripsDocumentInTemporaryDirectory() async throws {
        let temporaryDirectory = TestFixtures.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: temporaryDirectory) }

        let repository = try LibraryRepository(directoryURL: temporaryDirectory)
        var document = TestFixtures.document(pageIDs: ["page-one", "page-two"])
        document.activePageID = "page-two"
        document.tabs = [
            TabRecord(
                pageID: "page-two",
                isPinned: true,
                isPreview: false,
                lastAccessedAt: TestFixtures.date
            ),
        ]
        document.pages[1].content = [
            .object([
                "type": .string("paragraph"),
                "content": .array([.object(["text": .string("本地优先")])]),
            ]),
        ]
        document.pages[1].revision = 2

        try await repository.save(document)
        let loaded = try await repository.load()

        XCTAssertEqual(loaded, document)
        let libraryURL = await repository.libraryLocation()
        XCTAssertTrue(FileManager.default.fileExists(atPath: libraryURL.path))
    }

    func testCorruptLibraryIsCopiedToRecoveryDirectory() async throws {
        let temporaryDirectory = TestFixtures.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: temporaryDirectory) }
        try FileManager.default.createDirectory(at: temporaryDirectory, withIntermediateDirectories: true)
        let corruptData = Data("{这不是合法 JSON".utf8)
        let libraryURL = temporaryDirectory.appendingPathComponent("library.json")
        try corruptData.write(to: libraryURL)
        let repository = try LibraryRepository(directoryURL: temporaryDirectory)

        do {
            _ = try await repository.load()
            XCTFail("损坏的笔记库不应成功加载")
        } catch LibraryRepositoryError.corruptDocument(let recoveryURL) {
            XCTAssertTrue(FileManager.default.fileExists(atPath: recoveryURL.path))
            XCTAssertEqual(try Data(contentsOf: recoveryURL), corruptData)
            XCTAssertEqual(recoveryURL.deletingLastPathComponent().lastPathComponent, "Recovery")
        } catch {
            XCTFail("应返回 corruptDocument，实际为：\(error)")
        }
    }
}
