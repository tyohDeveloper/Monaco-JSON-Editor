import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { PaneLayout } from "./PaneLayout";
import { JsonTreePane } from "../tree/JsonTreePane";
import { InspectorPane } from "../inspector/InspectorPane";
import { SourcePane } from "../source/SourcePane";
import { SchemaErrorsPanel } from "../schema/SchemaErrorsPanel";
import { useJsonStore } from "../../store/useJsonStore";

function ToastStack() {
  const toasts = useJsonStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast"
          style={
            t.kind === "error"
              ? { background: "rgba(192, 57, 43, 0.95)" }
              : t.kind === "success"
              ? { background: "rgba(31, 122, 58, 0.95)" }
              : undefined
          }
        >
          {t.message}
        </div>
      ))}
    </>
  );
}

export function AppShell() {
  return (
    <div className="app-shell">
      <Toolbar />
      <PaneLayout
        left={<JsonTreePane />}
        middle={<InspectorPane />}
        right={<SourcePane />}
      />
      <SchemaErrorsPanel />
      <StatusBar />
      <ToastStack />
    </div>
  );
}
