import React, { useEffect, useState } from "react";
import Mermaid from "@theme-init/Mermaid";

// Renders <docdive-diagram> from the fence source. If the element bundle fails to load,
// fall back to the native Docusaurus Mermaid component.
export default function DocdiveMermaid(props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    window.__docdiveLoad?.catch(() => setFailed(true));
  }, []);
  if (failed) return React.createElement(Mermaid, props);
  return React.createElement("docdive-diagram", { source: props.value });
}
