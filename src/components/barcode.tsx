import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({
  value,
  height = 50,
  fontSize = 12,
  displayValue = true,
  format = "CODE128",
  className,
}: {
  value: string;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
  format?: string;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format,
        height,
        fontSize,
        displayValue,
        margin: 4,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // ignore render errors from invalid values
    }
  }, [value, height, fontSize, displayValue, format]);
  return <svg ref={ref} className={className} />;
}

export function printBarcodes(items: Array<{ name: string; barcode: string; sku?: string; price?: number }>) {
  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return;
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Barcodes</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.1/dist/JsBarcode.all.min.js"></script>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;padding:12px;color:#000;}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
    .lbl{border:1px dashed #999;border-radius:6px;padding:8px;text-align:center;page-break-inside:avoid;}
    .name{font-size:12px;font-weight:600;margin-bottom:2px;line-height:1.2;}
    .price{font-size:11px;color:#333;margin-top:2px;}
    @media print { .lbl{border:none} }
  </style></head><body>
  <div class="grid">
    ${items.map((it, i) => `<div class="lbl">
      <div class="name">${escapeHtml(it.name)}</div>
      <svg id="bc${i}"></svg>
      ${it.price != null ? `<div class="price">₹${Number(it.price).toFixed(2)}</div>` : ""}
    </div>`).join("")}
  </div>
  <script>
    window.onload = function() {
      var codes = ${JSON.stringify(items.map((i) => i.barcode))};
      codes.forEach(function(code, idx){
        try { JsBarcode('#bc'+idx, code, { format:'CODE128', height:44, fontSize:11, margin:2 }); } catch(e){}
      });
      setTimeout(function(){ window.print(); }, 250);
    };
  </script>
  </body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] as string));
}