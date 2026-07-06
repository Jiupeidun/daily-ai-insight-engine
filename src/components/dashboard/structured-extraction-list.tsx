"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const ROW_HEIGHT = 118;
const OVERSCAN = 4;

export type ExtractionListRow = {
  id: string;
  title: string;
  event: string;
  source: string;
  topics: string;
  impact: number;
  method: string;
};

export function StructuredExtractionList({ rows }: { rows: ExtractionListRow[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(360);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport == null) {
      return;
    }

    const updateHeight = () => setViewportHeight(viewport.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const { visibleRows, startIndex, totalHeight } = useMemo(() => {
    const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
    const last = Math.min(rows.length, first + visibleCount);
    return {
      startIndex: first,
      totalHeight: rows.length * ROW_HEIGHT,
      visibleRows: rows.slice(first, last).map((row, offset) => ({
        row,
        index: first + offset
      }))
    };
  }, [rows, scrollTop, viewportHeight]);

  const endIndex = Math.min(rows.length, startIndex + visibleRows.length);

  return (
    <div className="virtual-extraction">
      <div className="virtual-extraction-meta">
        <span>
          <span className="lang-zh">虚拟列表</span>
          <span className="lang-en">Virtual list</span>
        </span>
        <span>
          {startIndex + 1}-{endIndex} / {rows.length}
        </span>
      </div>
      <div
        ref={viewportRef}
        className="virtual-list"
        role="table"
        aria-label="Structured extraction results"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div className="virtual-list-spacer" style={{ height: totalHeight }}>
          {visibleRows.map(({ row, index }) => (
            <article
              className="extraction-row"
              key={row.id}
              style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
              role="row"
            >
              <div className="extraction-row-main">
                <h3>{row.title}</h3>
                <p>{row.event}</p>
              </div>
              <div className="extraction-row-meta">
                <span>{row.source}</span>
                <span>{row.topics}</span>
                <strong>{row.impact}</strong>
                <span>{row.method}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
