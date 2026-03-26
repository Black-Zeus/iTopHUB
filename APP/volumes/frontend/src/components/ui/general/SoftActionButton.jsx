import { Button } from "../../../ui/Button";

const SOFT_ACTION_BUTTON_CLASSNAME =
  "min-w-[148px] border-[rgba(81,152,194,0.44)] bg-[rgba(81,152,194,0.38)] px-5 text-[var(--accent-strong)] shadow-none hover:bg-[rgba(81,152,194,0.58)] hover:border-[rgba(81,152,194,0.58)] hover:text-white";

export function SoftActionButton({ children, className = "", ...props }) {
  return (
    <Button
      variant="primary"
      className={`${SOFT_ACTION_BUTTON_CLASSNAME} ${className}`.trim()}
      {...props}
    >
      {children}
    </Button>
  );
}
