import type { ReactNode } from "react";

import { cn } from "./utils";

type ProseProps = {
  children: ReactNode;
  className?: string;
};

export const Prose = ({ children, className }: ProseProps) => {
  return <article className={cn("prose-content", className)}>{children}</article>;
};
