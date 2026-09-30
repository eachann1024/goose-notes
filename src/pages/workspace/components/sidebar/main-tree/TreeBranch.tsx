import { Component, createRef, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";

const easeOut = [0.23, 1, 0.32, 1] as const;
type FocusGuardProps = { present: boolean; onReturnFocus: () => void; children: ReactNode };

/** Capture focus before inert is committed, then return it through RCT's focus action. */
class CollapseFocusGuard extends Component<FocusGuardProps> {
  private root = createRef<HTMLDivElement>();
  getSnapshotBeforeUpdate(previous: FocusGuardProps) {
    return previous.present && !this.props.present && !!this.root.current?.contains(document.activeElement);
  }
  componentDidUpdate(_previous: FocusGuardProps, _state: unknown, hadFocus: boolean) {
    if (hadFocus) this.props.onReturnFocus();
  }
  render() { return <div ref={this.root}>{this.props.children}</div>; }
}

function BranchContent({ children, onReturnFocus }: { children: ReactNode; onReturnFocus: () => void }) {
  const present = useIsPresent();
  const reduceMotion = useReducedMotion();
  return (
    <CollapseFocusGuard present={present} onReturnFocus={onReturnFocus}>
      <motion.div
        className="goose-tree-branch"
        inert={!present}
        aria-hidden={!present || undefined}
        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ height: { duration: reduceMotion ? 0 : 0.18, ease: easeOut }, opacity: { duration: reduceMotion ? 0 : 0.15, ease: easeOut } }}
        style={{ overflow: "hidden", overflowAnchor: "none" }}
      >{children}</motion.div>
    </CollapseFocusGuard>
  );
}

export function TreeBranch({ expanded, children, onReturnFocus }: { expanded: boolean; children: ReactNode; onReturnFocus: () => void }) {
  return <AnimatePresence initial={false}>{expanded && <BranchContent key="branch" onReturnFocus={onReturnFocus}>{children}</BranchContent>}</AnimatePresence>;
}
