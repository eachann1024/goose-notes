export type InlineMenuStatus =
  | "user-input"
  | "thinking"
  | "user-reviewing"
  | "error";
export type InlineMenuState =
  | "closed"
  | {
      blockId: string;
      status: InlineMenuStatus;
      prompt: string;
      input?: string;
      draft: string;
      ticker: string;
      error?: unknown;
    };

/** Request ownership is independent of fetch cancellation (providers can finish late). */
export function createInlineRewriteSession<Target, Draft>(deps: {
  getState: () => InlineMenuState;
  setState: (state: InlineMenuState) => void;
  capture: (blockId: string) => Target;
  validate: (target: Target) => void;
  rewrite: (
    target: Target,
    prompt: string,
    signal: AbortSignal,
    update: (text: string) => void,
  ) => Promise<string>;
  prepare: (target: Target, markdown: string) => Draft;
  apply: (target: Target, draft: Draft) => void;
}) {
  let target: Target | undefined;
  let draft: Draft | undefined;
  let controller: AbortController | undefined;
  let generation = 0;
  const cancel = () => {
    generation++;
    controller?.abort();
    controller = undefined;
  };
  const closeAIMenu = () => {
    cancel();
    target = undefined;
    draft = undefined;
    deps.setState("closed");
  };
  const rejectChanges = () => {
    cancel();
    draft = undefined;
    const state = deps.getState();
    if (state !== "closed")
      deps.setState({
        ...state,
        status: "user-input",
        draft: "",
        ticker: "",
        error: undefined,
      });
  };
  const submit = async (prompt: string) => {
    const state = deps.getState();
    if (state === "closed" || target === undefined || !prompt.trim()) return;
    cancel();
    const request = generation;
    const captured = target;
    const abort = new AbortController();
    controller = abort;
    draft = undefined;
    const pending = {
      ...state,
      prompt,
      draft: "",
      ticker: "",
      error: undefined,
    };
    const ownsRequest = () =>
      request === generation &&
      !abort.signal.aborted &&
      deps.getState() !== "closed";
    try {
      deps.validate(captured);
      deps.setState({ ...pending, status: "thinking" });
      const markdown = await deps.rewrite(
        captured,
        prompt,
        abort.signal,
        (ticker) => {
          if (!ownsRequest()) return;
          try {
            deps.validate(captured);
            deps.setState({ ...pending, status: "thinking", ticker });
          } catch {
            closeAIMenu();
          }
        },
      );
      if (!ownsRequest()) return;
      deps.validate(captured);
      const prepared = deps.prepare(captured, markdown);
      if (!ownsRequest()) return;
      draft = prepared;
      deps.setState({ ...pending, status: "user-reviewing", draft: markdown });
    } catch (error) {
      if (ownsRequest()) {
        try {
          deps.validate(captured);
        } catch {
          closeAIMenu();
          return;
        }
        deps.setState({ ...pending, status: "error", error });
      }
    } finally {
      if (controller === abort) controller = undefined;
    }
  };
  return {
    openAIMenuAtBlock(blockId: string) {
      closeAIMenu();
      try {
        target = deps.capture(blockId);
        deps.validate(target);
        deps.setState({
          blockId,
          status: "user-input",
          prompt: "",
          draft: "",
          ticker: "",
        });
      } catch (error) {
        deps.setState({
          blockId,
          status: "error",
          prompt: "",
          draft: "",
          ticker: "",
          error,
        });
      }
    },
    closeAIMenu,
    rejectChanges,
    abort: rejectChanges,
    submit,
    retry: () => {
      const state = deps.getState();
      if (state !== "closed") return submit(state.prompt);
    },
    acceptChanges() {
      const state = deps.getState();
      if (
        state === "closed" ||
        state.status !== "user-reviewing" ||
        target === undefined ||
        draft === undefined
      )
        return;
      try {
        deps.validate(target);
        deps.apply(target, draft);
        closeAIMenu();
      } catch (error) {
        draft = undefined;
        deps.setState({ ...state, status: "error", draft: "", error });
      }
    },
    invalidateIfNeeded() {
      if (target === undefined || deps.getState() === "closed") return;
      try {
        deps.validate(target);
      } catch {
        closeAIMenu();
      }
    },
  };
}
