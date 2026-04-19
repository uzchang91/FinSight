import { useEffect, useRef } from "react";
import "./HeaderGrid.css";

const COLS = 32;
const ROWS = 12;

const HeaderGrid = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Physical pixel buffer
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);

      // Reset transform before re-scaling to avoid stacking DPR on resize
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      draw(w, h);
    };

    const draw = (w, h) => {
      ctx.clearRect(0, 0, w, h);

      // Compute responsive column/row counts so cells stay square-ish
      const cellSize = Math.round(w / COLS);        // target cell width
      const cols = COLS;
      const rows = ROWS;

      ctx.strokeStyle = "hsla(255, 36%, 74%, 0.5)";
      ctx.lineWidth = 0.5;

      for (let c = 0; c <= cols; c++) {
        const x = Math.round((c / cols) * w) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      for (let r = 0; r <= rows; r++) {
        const y = Math.round((r / rows) * h) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    };

    let rafId;
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(setup);
    };

    setup();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className="header-canvas" />;
};

export default HeaderGrid;