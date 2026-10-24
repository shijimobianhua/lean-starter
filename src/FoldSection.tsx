import { useViewState } from "./view-state";
import {
  Children,
  isValidElement,
  useId,
  useState,
  useEffect,
  type ReactNode,
} from "react";
export function Disclosure({
  children,
  open = false,
  onToggle,
  className = "",
  lazy = false,
  memoryKey,
}: {
  children: ReactNode;
  open?: boolean;
  onToggle?: (e: { currentTarget: { open: boolean } }) => void;
  className?: string;
  lazy?: boolean;
  memoryKey?: string;
}) {
  const [expanded, setExpanded] = useViewState(memoryKey, open),
    id = useId(),
    shown = onToggle ? open : expanded;
  const [mounted, setMounted] = useState(shown);
  useEffect(() => {
    if (lazy && shown) setMounted(true);
  }, [lazy, shown]);
  const nodes = Children.toArray(children),
    title = nodes.find((x) => isValidElement(x) && x.type === "summary");
  const body = nodes.filter((x) => x !== title);
  return (
    <section className={"disclosure " + className} data-expanded={shown}>
      <button
        type="button"
        className="disclosure-summary"
        aria-expanded={shown}
        aria-controls={id}
        onClick={() => {
          setExpanded(!shown);
          onToggle?.({ currentTarget: { open: !shown } });
        }}
      >
        <svg
          className="disclosure-arrow"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path d="m6 3 5 5-5 5" />
        </svg>
        <span>
          {isValidElement<{ children: ReactNode }>(title)
            ? title.props.children
            : null}
        </span>
      </button>
      <div
        id={id}
        onTransitionEnd={(e) => {
          if (
            lazy &&
            !shown &&
            e.target === e.currentTarget &&
            e.propertyName === "grid-template-rows"
          )
            setMounted(false);
        }}
        className="disclosure-grid"
        aria-hidden={!shown}
        inert={!shown}
      >
        <div className="disclosure-body">
          {!lazy || mounted || shown ? body : null}
        </div>
      </div>
    </section>
  );
}
