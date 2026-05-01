import { useEffect, useRef } from "react";

function getPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = "touches" in event && event.touches?.length ? event.touches[0].clientX : event.clientX;
  const clientY = "touches" in event && event.touches?.length ? event.touches[0].clientY : event.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function SignatureCanvas({ onChange, canvasRef: externalCanvasRef }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.4;
    context.strokeStyle = "#0f172a";

    const beginStroke = (event) => {
      event.preventDefault();
      drawingRef.current = true;
      const point = getPoint(event, canvas);
      context.beginPath();
      context.moveTo(point.x, point.y);
    };

    const moveStroke = (event) => {
      if (!drawingRef.current) {
        return;
      }
      event.preventDefault();
      const point = getPoint(event, canvas);
      context.lineTo(point.x, point.y);
      context.stroke();
      if (!dirtyRef.current) {
        dirtyRef.current = true;
        onChange?.(true);
      }
    };

    const endStroke = () => {
      drawingRef.current = false;
    };

    canvas.addEventListener("pointerdown", beginStroke);
    canvas.addEventListener("pointermove", moveStroke);
    window.addEventListener("pointerup", endStroke);
    canvas.addEventListener("touchstart", beginStroke, { passive: false });
    canvas.addEventListener("touchmove", moveStroke, { passive: false });
    window.addEventListener("touchend", endStroke);

    const api = {
      clear() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        dirtyRef.current = false;
        onChange?.(false);
      },
      toDataUrl() {
        return dirtyRef.current ? canvas.toDataURL("image/png") : "";
      },
    };

    if (externalCanvasRef) {
      externalCanvasRef.current = api;
    }

    return () => {
      canvas.removeEventListener("pointerdown", beginStroke);
      canvas.removeEventListener("pointermove", moveStroke);
      window.removeEventListener("pointerup", endStroke);
      canvas.removeEventListener("touchstart", beginStroke);
      canvas.removeEventListener("touchmove", moveStroke);
      window.removeEventListener("touchend", endStroke);
      if (externalCanvasRef) {
        externalCanvasRef.current = null;
      }
    };
  }, [externalCanvasRef, onChange]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[210px] w-full rounded-[18px] border border-dashed border-[var(--border-color)] bg-white touch-none"
    />
  );
}

export default SignatureCanvas;
