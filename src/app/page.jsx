"use client";

import React, { useRef, useState, useEffect } from "react";

export default function HtmlCanvasRenderer() {
  const [html, setHtml] = useState(`
  <div style="font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding:24px; background:#f6f7f3; min-height:600px; width: 600px;">
    <h1 style="color:#0f172a; margin:0 0 8px 0;">Hello — editable canvas</h1>
    <p style="margin:0 0 12px 0; color:#334155;">Click any element to select it. Inline styles are preserved.</p>
    <button id="cta" style="padding:8px 12px; border-radius:8px; background:#7c3aed; color:white; border:none;">Click me</button>
    <div style="margin-top:16px; display:flex; gap:8px;">
      <div style="width:120px; height:80px; background:#ef4444; border-radius:6px;"></div>
      <div style="width:120px; height:80px; background:#10b981; border-radius:6px;"></div>
      <div style="width:120px; height:80px; background:#10b481; border-radius:6px;"></div>
      <div style="width:120px; height:80px; background:#10bf81; border-radius:6px;"></div>
    </div>
  </div>
  `);

  const containerRef = useRef(null);
  const [selectedPath, setSelectedPath] = useState(null); // CSS path or null
  const [highlightRect, setHighlightRect] = useState(null);
  const [scale, setScale] = useState(1);

  // utility to build a readable CSS path for the element

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

      const el = containerRef.current;
      if (!el) return;

      e.stopPropagation();
    }

    function handleScroll() {
      setHighlightRect(null);
      setSelectedPath(null);
    }
    function handleWheel(e) {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.min(Math.max(prev + delta, 0.2), 5));
      // also clear highlight when zooming
      setHighlightRect(null);
      setSelectedPath(null);
    }

    container.addEventListener("wheel", handleWheel, { passive: false });

    // use capture so we catch clicks before any user scripts inside the HTML
    container.addEventListener("click", onClick, true);
    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("click", onClick, true);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // When HTML changes re-deselect
  useEffect(() => {
    setSelectedPath(null);
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
    <div className="p-4 min-h-screen bg-[#000814]">
      <div className="grid grid-cols-3 gap-4">
        {/* Editor */}

        {/* Canvas */}
        <div className="">
          <div className="flex items-center justify-between mb-1">
            <h3 className=" text-white">Canvas preview</h3>
            <div className="text-xs text-slate-500">
              Click elements to select — press Delete to remove
            </div>
          </div>

          <div
            ref={containerRef}
            className="relative border border-blue-950 flex h-96 overflow-auto p-4 bg-[#000e23] items-center justify-center"
            style={{ minHeight: 800, minWidth: 1200 }}
          >
            {/* This wrapper contains the user HTML. We deliberately use dangerouslySetInnerHTML so inline styles are preserved. */}
            <div
              className="render-wrapper"
              style={{
                overflow: "auto",
                transform: `scale(${scale})`,
                transformOrigin: "center center", // zoom from center
              }}
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
                  left: highlightRect.left - 0.6 + "px",
                  width: highlightRect.width + "px",
                  height: highlightRect.height + "px",
                  outline: "3px solid rgba(124,58,237,0.9)",
                  outlineOffset: "-2px", // optional, shrink slightly inside
                  borderRadius: 0,
                  zIndex: 40,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
