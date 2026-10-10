cask "goose-note" do
  arch arm: "-arm64", intel: ""
  version "1.7.42,2ecbe1a"
  sha256 arm: "77e2db7e341a8b743b9fd905026e2b89f18fc4586b203f99ef248a8f00a312a8",
         intel: "f5fd7fd919c15b9e80d4dc966e6513f3de941f41d803c5b10f8bcdbcfbb48d7b"
  url "https://github.com/eachann1024/goose-notes/releases/download/v#{version.csv.first}-#{version.csv.second}/Goose.Note-#{version.csv.first}#{arch}.dmg"
  name "Goose Note"
  desc "Local-first Markdown notes with AI"
  homepage "https://github.com/eachann1024/goose-notes"
  depends_on :macos
  app "Goose Note.app"
  zap trash: [
    "~/Library/Application Support/Goose Note",
    "~/Library/Logs/Goose Note",
    "~/Library/Preferences/com.goosenote.desktop.plist",
    "~/Library/Saved Application State/com.goosenote.desktop.savedState",
  ]
  caveats <<~EOS
    Goose Note is currently unsigned and not notarized.
    After installing, allow it in System Settings → Privacy & Security.
    If needed, run: xattr -cr "/Applications/Goose Note.app"
  EOS
end
