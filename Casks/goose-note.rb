cask "goose-note" do
  arch arm: "-arm64", intel: ""
  version "1.7.27,9f34c60"
  sha256 arm: "3e3653eaf00afca7c460260a54f4eadc04290e0379b67d661b7738d4797851bd",
         intel: "f25eae9d3658a571116f439294c374a0838c53edf7e321c9f98b6718868d8154"
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
