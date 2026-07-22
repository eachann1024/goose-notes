export type NativeEditorAppearance = "light" | "dark";
export type NativeEditorFont = "sans" | "serif" | "mono";
export type NativeEditorMode = "blocks" | "repair-required" | "unavailable";
export type EditorCommandName =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "numberedList"
  | "checkList"
  | "blockquote"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "clearFormatting"
  | "link"
  | "find"
  | "findNext"
  | "findPrevious";

export interface BridgeEnvelope {
  version: 1;
  requestID: string;
  pageID: string;
  revision: number;
}

export interface EditorPagePayload extends BridgeEnvelope {
  generation: number;
  title: string;
  markdown: string;
  appearance: NativeEditorAppearance;
  editorFont: NativeEditorFont;
  editorFontSize: number;
  fullWidth: boolean;
  reduceMotion: boolean;
  increaseContrast: boolean;
}

export type EditorPageInput = Omit<EditorPagePayload, "requestID"> & {
  requestID?: string;
};

export interface EditorPreferences extends BridgeEnvelope {
  appearance: NativeEditorAppearance;
  editorFont: NativeEditorFont;
  editorFontSize: number;
  fullWidth: boolean;
  reduceMotion: boolean;
  increaseContrast: boolean;
}

export interface EditorDraft extends BridgeEnvelope {
  baseRevision: number;
  title: string;
  markdown: string;
  hasChanges: boolean;
}

export interface SaveAcknowledgement extends BridgeEnvelope {
  status: "saved" | "conflict" | "failed";
  message?: string;
}

export interface LocalResourceAcknowledgement extends BridgeEnvelope {
  status: "resolved" | "rejected" | "failed";
  url?: string;
  message?: string;
}

export interface LocalAssetAcknowledgement extends BridgeEnvelope {
  status: "saved" | "rejected" | "failed";
  relativePath?: string;
  mediaType?: string;
  message?: string;
}

export interface EditorCommand extends BridgeEnvelope {
  name: EditorCommandName;
}

export type HostMessage =
  | (EditorDraft & { type: "change" })
  | (BridgeEnvelope & { type: "ready" | "dirty" | "reloadRequest" })
  | (BridgeEnvelope & { type: "resolveLocalResource"; source: string })
  | (BridgeEnvelope & {
      type: "saveLocalAsset";
      filename: string;
      mediaType: string;
      base64: string;
    })
  | (BridgeEnvelope & { type: "openExternalLink"; url: string })
  | (BridgeEnvelope & { type: "diagnostic"; message: string });

export interface GooseNativeEditorAPI {
  receivePage(page: EditorPageInput): Promise<void> | void;
  receiveAcknowledgement(acknowledgement: SaveAcknowledgement): void;
  receiveLocalResource(acknowledgement: LocalResourceAcknowledgement): void;
  receiveLocalAsset(acknowledgement: LocalAssetAcknowledgement): void;
  updatePreferences(preferences: EditorPreferences): void;
  clear(envelope: BridgeEnvelope): void;
  dispatchCommand(command: EditorCommand): void;
  flushAndGetDraft(envelope?: BridgeEnvelope): Promise<EditorDraft>;
  focusEditor(envelope: BridgeEnvelope): void;
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        gooseNotes?: { postMessage(message: HostMessage): void };
      };
    };
    gooseEditor: GooseNativeEditorAPI;
    __gooseBridgeContext?: Pick<BridgeEnvelope, "pageID" | "revision">;
  }
}
