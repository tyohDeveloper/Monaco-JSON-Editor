import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface PaneLayoutProps {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
  initialLeftPct?: number;
  initialRightPct?: number;
  minPaneWidth?: number;
}

const STORAGE_KEY = "jsonExplorer.paneSizes.v1";

export function PaneLayout({
  left,
  middle,
  right,
  initialLeftPct = 28,
  initialRightPct = 36,
  minPaneWidth = 160,
}: PaneLayoutProps) {
  const [sizes, setSizes] = useState<{ left: number; right: number }>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { left: number; right: number };
        if (
          typeof parsed.left === "number" &&
          typeof parsed.right === "number" &&
          parsed.left + parsed.right < 90
        ) {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
    return { left: initialLeftPct, right: initialRightPct };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
    } catch {
      /* ignore */
    }
  }, [sizes]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ which: "left" | "right"; startX: number; startLeft: number; startRight: number; width: number } | null>(null);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);

  const onMouseDown = useCallback(
    (which: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      const c = containerRef.current;
      if (!c) return;
      dragRef.current = {
        which,
        startX: e.clientX,
        startLeft: sizes.left,
        startRight: sizes.right,
        width: c.getBoundingClientRect().width,
      };
      setDragging(which);
    },
    [sizes],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dxPct = ((e.clientX - d.startX) / d.width) * 100;
      const minPct = (minPaneWidth / d.width) * 100;
      if (d.which === "left") {
        let nextLeft = d.startLeft + dxPct;
        const maxLeft = 100 - d.startRight - minPct;
        nextLeft = Math.max(minPct, Math.min(maxLeft, nextLeft));
        setSizes((s) => ({ ...s, left: nextLeft }));
      } else {
        let nextRight = d.startRight - dxPct;
        const maxRight = 100 - d.startLeft - minPct;
        nextRight = Math.max(minPct, Math.min(maxRight, nextRight));
        setSizes((s) => ({ ...s, right: nextRight }));
      }
    };
    const onUp = () => {
      dragRef.current = null;
      setDragging(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
  }, [dragging, minPaneWidth]);

  const leftStyle = { flexBasis: `${sizes.left}%` };
  const rightStyle = { flexBasis: `${sizes.right}%` };
  const middleStyle = { flexBasis: `${100 - sizes.left - sizes.right}%` };

  return (
    <div className="pane-layout" ref={containerRef}>
      <div className="pane left" style={leftStyle}>
        {left}
      </div>
      <div
        className={`resizer${dragging === "left" ? " dragging" : ""}`}
        onMouseDown={onMouseDown("left")}
        role="separator"
        aria-orientation="vertical"
      />
      <div className="pane middle" style={middleStyle}>
        {middle}
      </div>
      <div
        className={`resizer${dragging === "right" ? " dragging" : ""}`}
        onMouseDown={onMouseDown("right")}
        role="separator"
        aria-orientation="vertical"
      />
      <div className="pane right" style={rightStyle}>
        {right}
      </div>
    </div>
  );
}
