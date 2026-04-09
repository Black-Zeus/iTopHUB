import { Button } from "../../../ui/Button";

const SOFT_ACTION_BUTTON_CLASSNAME =
  "min-w-[148px] border-[rgba(81,152,194,0.56)] bg-[rgba(81,152,194,0.7)] px-5 text-white shadow-none hover:bg-[rgba(81,152,194,0.82)] hover:border-[rgba(81,152,194,0.82)] hover:text-white";

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
