"use client";

import React, { useRef, useState, useEffect } from "react";

export default function HtmlCanvasRenderer() {
  const [html, setHtml] = useState(`
<div style="font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding:24px; background:#f6f7fb; min-height:240px;">
  <h1 style="color:#0f172a; margin:0 0 8px 0;">Hello — editable canvas</h1>
  <p style="margin:0 0 12px 0; color:#334155;">Click any element to select it. Inline styles are preserved.</p>
  <button id="cta" style="padding:8px 12px; border-radius:8px; background:#7c3aed; color:white; border:none;">Click me</button>
  <div style="margin-top:16px; display:flex; gap:8px;">
    <div style="width:120px; height:80px; background:#ef4444; border-radius:6px;"></div>
    <div style="width:120px; height:80px; background:#10b981; border-radius:6px;"></div>
    <div style="width:120px; height:80px; background:#10b981; border-radius:6px;"></div>
  </div>
</div>
  `);

  const containerRef = useRef(null);
  const [selectedPath, setSelectedPath] = useState(null); // CSS path or null
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [highlightRect, setHighlightRect] = useState(null);

  // utility to build a readable CSS path for the element
  function buildPath(el, root) {
    if (!el || el === root || el === document) return null;
    const parts = [];
    let node = el;
    while (node && node !== root && node !== document) {
      let part = node.tagName ? node.tagName.toLowerCase() : "";
      if (node.id) part += `#${node.id}`;
      else if (node.classList && node.classList.length)
        part += `.${[...node.classList].join(".")}`;
      const parent = node.parentElement;
      if (parent) {
        const sameTagSiblings = Array.from(parent.children).filter(
          (c) => c.tagName === node.tagName
        );
        if (sameTagSiblings.length > 1) {
          const idx = Array.from(parent.children).indexOf(node) + 1; // 1-based
          part += `:nth-child(${idx})`;
        }
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  // When the user clicks inside the render area, capture the target element
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onClick(e) {
      // ignore clicks on the overlay/inspector
      if (!container.contains(e.target)) return;

      // find the deepest element within the rendered HTML (we render the HTML inside a child wrapper)
      // We want to avoid selecting the container itself.
      let target = e.target;
      // If user clicked the container wrapper (empty space), deselect
      const wrapper = container.querySelector(".render-wrapper");
      if (!wrapper) return;
      if (target === container || target === wrapper) {
        setSelectedPath(null);
        setSelectedInfo(null);
        setHighlightRect(null);
        return;
      }

      // Compute bounding rect relative to container
      const rect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const relative = {
        top: rect.top - containerRect.top + container.scrollTop,
        left: rect.left - containerRect.left + container.scrollLeft,
        width: rect.width,
        height: rect.height,
      };

      setHighlightRect(relative);
      const path = buildPath(target, wrapper);
      setSelectedPath(path);

      // collect info
      const info = {
        tag: target.tagName?.toLowerCase(),
        id: target.id || null,
        classes: target.className || null,
        inlineStyle: target.getAttribute("style") || null,
        text: target.innerText?.slice(0, 200) || "",
      };
      setSelectedInfo(info);

      e.stopPropagation();
    }

    // use capture so we catch clicks before any user scripts inside the HTML
    container.addEventListener("click", onClick, true);

    return () => container.removeEventListener("click", onClick, true);
  }, []);

  // When HTML changes re-deselect
  useEffect(() => {
    setSelectedPath(null);
    setSelectedInfo(null);
    setHighlightRect(null);
  }, [html]);

  // keyboard: delete selected element
  useEffect(() => {
    function onKey(e) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedPath) {
        const wrapper = containerRef.current.querySelector(".render-wrapper");
        if (!wrapper) return;
        try {
          const el =
            wrapper.querySelector(
              selectedPath.replace(/:nth-child\(\d+\)/g, "")
            ) || wrapper.querySelector(selectedPath);
          if (el) {
            el.remove();
            setSelectedPath(null);
            setSelectedInfo(null);
            setHighlightRect(null);
          }
        } catch (err) {
          // ignore selector errors
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPath]);

  return (
    <div className="p-4 min-h-screen bg-white">
      <div className="grid grid-cols-3 gap-4">
        {/* Editor */}
        <div className="col-span-1">
          <label className="block text-sm font-medium mb-2 text-black">
            HTML + inline CSS
          </label>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="w-full text-black h-96 p-2 border rounded resize-none font-mono text-xs"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                // render is automatic because we bind html to innerHTML; this button can be used to reset selection
                setSelectedPath(null);
                setSelectedInfo(null);
                setHighlightRect(null);
              }}
              className="px-3 py-1 rounded bg-slate-800 text-white"
            >
              Render
            </button>
            <button
              onClick={() => {
                setHtml("");
                setSelectedPath(null);
                setSelectedInfo(null);
                setHighlightRect(null);
              }}
              className="px-3 py-1 rounded border text-white bg-blue-900"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="col-span-2 relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-black">Canvas preview</h3>
            <div className="text-xs text-slate-500">
              Click elements to select — press Delete to remove
            </div>
          </div>

          <div
            ref={containerRef}
            className="relative border rounded h-96 overflow-auto p-4 bg-white"
            style={{ minHeight: 300 }}
          >
            {/* This wrapper contains the user HTML. We deliberately use dangerouslySetInnerHTML so inline styles are preserved. */}
            <div
              className="render-wrapper"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* highlight overlay */}
            {highlightRect && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  pointerEvents: "none",
                  top: highlightRect.top + "px",
                  left: highlightRect.left + "px",
                  width: highlightRect.width + "px",
                  height: highlightRect.height + "px",
                  boxShadow:
                    "0 0 0 2px rgba(124,58,237,0.9), 0 4px 12px rgba(2,6,23,0.12)",
                  borderRadius: 6,
                  transition: "all 120ms ease",
                  zIndex: 40,
                }}
              />
            )}
          </div>

          {/* Inspector */}
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="p-3 border rounded bg-gray-50 text-black">
              <h4 className="text-xs font-medium mb-2">Selection</h4>
              {selectedInfo ? (
                <div className="text-xs space-y-1">
                  <div>
                    <strong>Path:</strong>{" "}
                    <code className="break-all">{selectedPath}</code>
                  </div>
                  <div>
                    <strong>Tag:</strong> {selectedInfo.tag}
                  </div>
                  <div>
                    <strong>Id:</strong> {selectedInfo.id || "—"}
                  </div>
                  <div>
                    <strong>Classes:</strong> {selectedInfo.classes || "—"}
                  </div>
                  <div>
                    <strong>Inline style:</strong>{" "}
                    <div className="mt-1 p-2 bg-white rounded text-xs font-mono">
                      {selectedInfo.inlineStyle || "—"}
                    </div>
                  </div>
                  <div>
                    <strong>Text:</strong>{" "}
                    <div className="mt-1 text-sm text-slate-600">
                      {selectedInfo.text}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  No element selected. Click an element inside the canvas.
                </div>
              )}
            </div>

            <div className="p-3 border rounded bg-gray-50 text-black">
              <h4 className="text-xs font-medium mb-2">Actions</h4>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    // scroll selected into view
                    if (!selectedPath) return;
                    const wrapper =
                      containerRef.current.querySelector(".render-wrapper");
                    if (!wrapper) return;
                    try {
                      const el =
                        wrapper.querySelector(
                          selectedPath.replace(/:nth-child\(\d+\)/g, "")
                        ) || wrapper.querySelector(selectedPath);
                      if (el)
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                    } catch (err) {}
                  }}
                  className="px-3 py-1 rounded border text-sm"
                >
                  Scroll into view
                </button>

                <button
                  onClick={() => {
                    // copy outerHTML
                    if (!selectedPath) return;
                    const wrapper =
                      containerRef.current.querySelector(".render-wrapper");
                    try {
                      const el =
                        wrapper.querySelector(
                          selectedPath.replace(/:nth-child\(\d+\)/g, "")
                        ) || wrapper.querySelector(selectedPath);
                      if (el) navigator.clipboard.writeText(el.outerHTML);
                    } catch (err) {}
                  }}
                  className="px-3 py-1 rounded border text-sm"
                >
                  Copy outerHTML
                </button>

                <button
                  onClick={() => {
                    setHtml("");
                    setSelectedPath(null);
                    setSelectedInfo(null);
                    setHighlightRect(null);
                  }}
                  className="px-3 py-1 rounded border text-sm"
                >
                  Clear canvas
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
