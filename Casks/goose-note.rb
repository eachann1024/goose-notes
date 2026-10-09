cask "goose-note" do
  arch arm: "-arm64", intel: ""
  version "1.7.28,df0efbd"
  sha256 arm: "af8c98e17f7191515d11435c403cf343acf5287f1308d4a22e5f468d161f2ffd",
         intel: "7f3f831cd1fea339dd28b4644b46d50630e5eed656d8f49f976625922931694f"
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
