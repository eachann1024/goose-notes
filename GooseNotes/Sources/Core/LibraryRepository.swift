import Foundation

enum LibraryRepositoryError: LocalizedError {
    case unsupportedVersion(Int)
    case invalidDocument
    case corruptDocument(recoveryURL: URL)

    var errorDescription: String? {
        switch self {
        case .unsupportedVersion(let version):
            return "笔记库版本 \(version) 暂不受支持。"
        case .invalidDocument:
            return "笔记库结构不完整。"
        case .corruptDocument(let recoveryURL):
            return "笔记库无法读取，原文件已保存在 \(recoveryURL.lastPathComponent)。"
        }
    }
}

actor LibraryRepository {
    private let fileManager: FileManager
    private let directoryURL: URL
    private let libraryURL: URL
    private let recoveryDirectoryURL: URL
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(directoryURL: URL? = nil, fileManager: FileManager = .default) throws {
        self.fileManager = fileManager
        if let directoryURL {
            self.directoryURL = directoryURL
        } else {
            let applicationSupport = try fileManager.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            self.directoryURL = applicationSupport.appendingPathComponent("Goose Notes", isDirectory: true)
        }
        libraryURL = self.directoryURL.appendingPathComponent("library.json")
        recoveryDirectoryURL = self.directoryURL.appendingPathComponent("Recovery", isDirectory: true)

        encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        encoder.dateEncodingStrategy = .iso8601
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
    }

    func load() throws -> LibraryDocument {
        try prepareDirectories()
        guard fileManager.fileExists(atPath: libraryURL.path) else {
            return .empty()
        }

        do {
            var coordinationError: NSError?
            var coordinatedData: Data?
            NSFileCoordinator().coordinate(
                readingItemAt: libraryURL,
                options: .withoutChanges,
                error: &coordinationError
            ) { url in
                coordinatedData = try? Data(contentsOf: url)
            }
            if let coordinationError { throw coordinationError }
            guard let coordinatedData else { throw LibraryRepositoryError.invalidDocument }
            var document = try decoder.decode(LibraryDocument.self, from: coordinatedData)
            guard document.version == LibraryDocument.currentVersion else {
                throw LibraryRepositoryError.unsupportedVersion(document.version)
            }
            guard !document.notebooks.isEmpty else { throw LibraryRepositoryError.invalidDocument }
            document.normalize()
            return document
        } catch let error as LibraryRepositoryError {
            throw error
        } catch {
            let recoveryURL = try preserveCorruptLibrary()
            throw LibraryRepositoryError.corruptDocument(recoveryURL: recoveryURL)
        }
    }

    func save(_ sourceDocument: LibraryDocument) throws {
        try prepareDirectories()
        var document = sourceDocument
        document.normalize()
        let data = try encoder.encode(document)

        var coordinationError: NSError?
        var writeError: Error?
        NSFileCoordinator().coordinate(
            writingItemAt: libraryURL,
            options: .forReplacing,
            error: &coordinationError
        ) { url in
            do {
                try data.write(to: url, options: [.atomic, .completeFileProtectionUnlessOpen])
            } catch {
                writeError = error
            }
        }
        if let coordinationError { throw coordinationError }
        if let writeError { throw writeError }
    }

    func libraryLocation() -> URL {
        libraryURL
    }

    private func prepareDirectories() throws {
        try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: recoveryDirectoryURL, withIntermediateDirectories: true)
    }

    private func preserveCorruptLibrary() throws -> URL {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        let recoveryURL = recoveryDirectoryURL
            .appendingPathComponent("library-\(formatter.string(from: Date())).json")
        if fileManager.fileExists(atPath: recoveryURL.path) {
            try fileManager.removeItem(at: recoveryURL)
        }
        try fileManager.copyItem(at: libraryURL, to: recoveryURL)
        return recoveryURL
    }
}
