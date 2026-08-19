"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SignatureStroke } from "@/lib/consent/types";

type Props = { value: SignatureStroke[]; onChange: (strokes: SignatureStroke[]) => void };

export default function SignaturePad({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const currentRef = useRef<SignatureStroke | null>(null);
  const baseRef = useRef<SignatureStroke[]>(value);
  const [hasInk, setHasInk] = useState(value.length > 0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#14213d";
    for (const stroke of value) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * rect.width, stroke.points[0].y * rect.height);
      stroke.points.slice(1).forEach((point) => ctx.lineTo(point.x * rect.width, point.y * rect.height));
      ctx.stroke();
    }
  }, [value]);

  useEffect(() => {
    redraw();
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redraw]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    baseRef.current = value;
    currentRef.current = { points: [point(event)] };
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentRef.current) return;
    event.preventDefault();
    currentRef.current.points.push(point(event));
    onChange([...baseRef.current, { points: [...currentRef.current.points] }]);
    setHasInk(true);
  }

  function end(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
    const completed = currentRef.current;
    currentRef.current = null;
    if (completed.points.length > 1) onChange([...baseRef.current, completed]);
  }

  return <div className="dc-signature-wrap"><canvas ref={canvasRef} className="dc-signature" aria-label="Signature area" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/><div className="dc-signature-footer"><span>{hasInk ? "Signature captured" : "Sign with finger or stylus"}</span><button type="button" className="dc-link" onClick={() => { onChange([]); setHasInk(false); }}>Clear</button></div></div>;
}
