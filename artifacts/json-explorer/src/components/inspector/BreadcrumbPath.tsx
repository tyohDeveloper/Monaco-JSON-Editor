import { useJsonStore } from "../../store/useJsonStore";
import { pathToBreadcrumb } from "../../lib/jsonPath";
import type { JsonPath } from "../../lib/jsonPath";

interface Props {
  path: JsonPath;
}

export function BreadcrumbPath({ path }: Props) {
  const text = pathToBreadcrumb(path);
  const pushToast = useJsonStore((s) => s.pushToast);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast("success", "Path copied");
    } catch (e) {
      pushToast("error", `Copy failed: ${(e as Error).message}`);
    }
  };
  return (
    <div className="breadcrumb">
      <span className="breadcrumb-text" title={text}>{text}</span>
      <button className="breadcrumb-copy" onClick={handleCopy} title="Copy path">
        Copy
      </button>
    </div>
  );
}
