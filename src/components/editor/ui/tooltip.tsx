import * as React from "react";
import { TooltipContent as Content } from "@/components/ui/tooltip";
export {
  Tooltip,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Content>
>(({ editorContext = true, ...props }, ref) => (
  <Content {...props} ref={ref} editorContext={editorContext} />
));
TooltipContent.displayName = "TooltipContent";
export { TooltipContent };
