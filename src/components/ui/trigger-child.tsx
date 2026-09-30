import * as React from "react";
import { useMergeRefs } from "@floating-ui/react";
import { cn } from "@/lib/utils";

type ChildProps = React.HTMLAttributes<HTMLElement> & {
  ref?: React.Ref<HTMLElement>;
};
/** HeroUI render 的单子节点桥：保留已有 DOM/ref，先执行业务事件，再执行未取消的触发事件。 */
export function TriggerChild({
  child,
  injected,
}: {
  child: React.ReactElement<ChildProps>;
  injected: ChildProps;
}) {
  const ref = useMergeRefs([child.props.ref, injected.ref]);
  const props = {
    ...injected,
    ...child.props,
    ref,
    className: cn(injected.className, child.props.className),
  };
  for (const key of Object.keys(injected)) {
    if (!/^on[A-Z]/.test(key)) continue;
    const eventKey = key as keyof React.DOMAttributes<HTMLElement>;
    const trigger = injected[eventKey];
    const own = child.props[eventKey];
    if (typeof trigger === "function" && typeof own === "function") {
      Object.assign(props, {
        [key]: (event: React.SyntheticEvent<HTMLElement>) => {
          (own as React.EventHandler<React.SyntheticEvent<HTMLElement>>)(event);
          if (!event.defaultPrevented)
            (trigger as React.EventHandler<React.SyntheticEvent<HTMLElement>>)(
              event,
            );
        },
      });
    }
  }
  return React.cloneElement(child, props);
}
