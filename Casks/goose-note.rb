cask "goose-note" do
  arch arm: "-arm64", intel: ""
  version "1.7.27,6f91ee5"
  sha256 arm: "6a60a893992a57c1283fb40c067525fa07a7855e7393ae6ecee03e9e3ee6c811",
         intel: "2f43e5a6be1c385ba91fedecf0d0bd0640113a0ed675988c83e2c51cf9023dfb"
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
