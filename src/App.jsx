import React, { useEffect, useMemo, useState } from "react";

/** Claves de almacenamiento */
const LS_INSUMOS = "inventario_insumos_v2";
const LS_PRODUCTOS = "inventario_productos_v2";
const LS_VENTAS = "inventario_ventas_v1";

/** Utilidades */
const uid = () => Math.random().toString(36).slice(2, 9);
const currency = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const toNum = (v) => (Number.isNaN(parseFloat(v)) ? 0 : parseFloat(v));
const parseDecimal = (v) =>
  v === "" || v === null || v === undefined
    ? NaN
    : parseFloat(String(v).replace(",", "."));
const todayISO = () => new Date().toISOString().slice(0, 10);
const ym = (dIso) => (dIso || "").slice(0, 7);
const pad2 = (n) => String(n).padStart(2, "0");

/** Colores predefinidos e intensidad para sombrear filas */
const PRESET_COLORS = ["#FFCDD2", "#FFF59D", "#B2EBF2"];
const ALPHA = "55";

/* ---------- UI auxiliares ---------- */
const Badge = ({ title, value }) => (
  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: 10,
      padding: "10px 12px",
      minWidth: 160,
      background: "#fafafa",
    }}
  >
    <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
  </div>
);

const tabBtn = (active) => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: active ? "#111" : "#fff",
  color: active ? "#fff" : "#111",
  cursor: "pointer",
});
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.3)",
  display: "grid",
  placeItems: "center",
  padding: 12,
  zIndex: 50,
};
const modal = {
  background: "#fff",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #ddd",
  width: "min(820px, 100%)",
};

/* Helpers CSV */
function csvEscape(s) {
  const str = String(s ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default function App() {
  const [tab, setTab] = useState("insumos"); // "insumos" | "productos" | "ventas" | "plan"

  /* ===================== INSUMOS ===================== */
  const [insumos, setInsumos] = useState(() => {
    const guardado = localStorage.getItem(LS_INSUMOS);
    const arr = guardado ? JSON.parse(guardado) : [];
    return arr.map((i) => ({ ...i, id: String(i.id) }));
  });
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");

  useEffect(() => {
    localStorage.setItem(LS_INSUMOS, JSON.stringify(insumos));
  }, [insumos]);

  const agregarInsumo = () => {
    if (!nombre || cantidad === "" || precio === "") {
      alert("Completa nombre, cantidad y precio");
      return;
    }
    const cant = parseDecimal(cantidad);
    const prec = parseDecimal(precio);
    if (Number.isNaN(cant) || Number.isNaN(prec)) {
      alert("Cantidad y precio deben ser números válidos (ej: 2.5 o 2,5)");
      return;
    }
    const nuevo = {
      id: String(uid()),
      nombre: nombre.trim(),
      cantidad: cant,
      precio: prec,
    };
    setInsumos((xs) => [...xs, nuevo]);
    setNombre("");
    setCantidad("");
    setPrecio("");
  };

  const eliminarInsumo = (id) => {
    setInsumos((xs) => xs.filter((i) => i.id !== id));
  };

  const editarInsumo = (id, campo, valor) => {
    setInsumos((xs) =>
      xs.map((i) =>
        i.id === id
          ? {
              ...i,
              [campo]: campo === "nombre" ? valor : parseDecimal(valor) || 0,
            }
          : i
      )
    );
  };

  const totalInsumos = insumos.reduce(
    (acc, i) => acc + i.cantidad * i.precio,
    0
  );

  const insumoById = useMemo(() => {
    const m = new Map();
    insumos.forEach((i) => m.set(String(i.id), i));
    return m;
  }, [insumos]);

  /* ===================== PRODUCTOS ===================== */
  // producto: { id, nombre, ganancia, precioVenta(opcional), receta: [{insumoId, cantidad}] }
  const [productos, setProductos] = useState(() => {
    const raw = localStorage.getItem(LS_PRODUCTOS);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.map((p) => ({
      ...p,
      id: String(p.id || uid()),
      receta: (p.receta || []).map((r) => ({
        ...r,
        insumoId: String(r.insumoId),
      })),
    }));
  });

  useEffect(() => {
    localStorage.setItem(LS_PRODUCTOS, JSON.stringify(productos));
  }, [productos]);

  const costoDeReceta = (receta) =>
    (receta || []).reduce((acc, r) => {
      const ins = insumoById.get(String(r.insumoId));
      const cant = parseDecimal(r.cantidad) || 0;
      const precio = ins ? Number(ins.precio) : 0;
      return acc + cant * precio;
    }, 0);

  const [pModalOpen, setPModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({
    nombre: "",
    precioVenta: "",
    ganancia: "",
    receta: [],
  });
  const costoDraft = useMemo(
    () => costoDeReceta(draft.receta),
    [draft, insumoById]
  );

  const abrirNuevoProducto = () => {
    setEditId(null);
    setDraft({ nombre: "", precioVenta: "", ganancia: "", receta: [] });
    setPModalOpen(true);
  };
  const abrirEditarProducto = (prod) => {
    setEditId(prod.id);
    setDraft({
      nombre: prod.nombre,
      precioVenta: prod.precioVenta ?? "",
      ganancia: prod.ganancia ?? "",
      receta: (prod.receta || []).map((r) => ({
        ...r,
        insumoId: String(r.insumoId),
      })),
    });
    setPModalOpen(true);
  };
  const guardarProducto = (e) => {
    e.preventDefault();
    if (!draft.nombre?.trim()) return alert("Pon un nombre para el producto");

    const precioVentaNum =
      draft.precioVenta === "" ? "" : parseFloat(draft.precioVenta);
    const gananciaNum = draft.ganancia === "" ? "" : parseFloat(draft.ganancia);

    const costo = costoDeReceta(draft.receta);
    const precioCalculado =
      draft.precioVenta === "" && !Number.isNaN(gananciaNum)
        ? +(costo + (Number.isNaN(gananciaNum) ? 0 : gananciaNum)).toFixed(2)
        : Number.isNaN(precioVentaNum)
        ? ""
        : precioVentaNum;

    const clean = {
      id: editId || String(uid()),
      nombre: draft.nombre.trim(),
      precioVenta: precioCalculado,
      ganancia: Number.isNaN(gananciaNum) ? "" : gananciaNum,
      receta:
        draft.receta?.filter((r) => r.insumoId && r.cantidad !== "") || [],
    };

    if (editId)
      setProductos((xs) =>
        xs.map((p) => (p.id === editId ? { ...p, ...clean } : p))
      );
    else setProductos((xs) => [clean, ...xs]);

    setPModalOpen(false);
  };
  const eliminarProducto = (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    setProductos((xs) => xs.filter((p) => p.id !== id));
  };
  const costoProducto = (p) => costoDeReceta(p.receta || []);
  const productoPorId = (id) =>
    productos.find((p) => String(p.id) === String(id));

  /* ===================== VENTAS (sin descontar inventario) ===================== */
  // venta: { id, productId, qty, place, dateISO, name, hora, color, obs, unitCost?, unitGain?, unitPrice?, productNameSnapshot? }
  const [ventas, setVentas] = useState(() => {
    const raw = localStorage.getItem(LS_VENTAS);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.map((v) => ({
      id: String(v.id || uid()),
      productId: String(v.productId),
      qty: toNum(v.qty),
      place: v.place || "",
      dateISO: v.dateISO || todayISO(),
      name: v.name || "",
      hora: v.hora || "",
      color: v.color || "",
      obs: v.obs || "",
      unitCost: typeof v.unitCost === "number" ? v.unitCost : undefined,
      unitGain: typeof v.unitGain === "number" ? v.unitGain : undefined,
      unitPrice: typeof v.unitPrice === "number" ? v.unitPrice : undefined,
      productNameSnapshot: v.productNameSnapshot || undefined,
    }));
  });
  const [mes, setMes] = useState(ym(todayISO()));

  useEffect(() => {
    localStorage.setItem(LS_VENTAS, JSON.stringify(ventas));
  }, [ventas]);

  const [ventaDraft, setVentaDraft] = useState({
    productId: "",
    qty: "",
    name: "",
    place: "",
    dateISO: todayISO(),
    hora: "",
  });

  // calcular unitario al momento de vender (snapshot)
  const costoUnitDeProducto = (productId) => {
    const p = productoPorId(productId);
    return p ? costoProducto(p) : 0;
  };
  const gananciaBaseDeProducto = (productId) => {
    const p = productoPorId(productId);
    return p ? toNum(p.ganancia) : 0;
  };

  // ⚠️ Ya NO se descuenta inventario al vender
  const agregarVenta = () => {
    if (!ventaDraft.productId) return alert("Elige un producto");
    if (ventaDraft.qty === "") return alert("Pon cantidad");
    const qty = toNum(ventaDraft.qty);
    if (qty <= 0) return alert("Cantidad debe ser > 0");

    const cUnit = costoUnitDeProducto(ventaDraft.productId);
    const gUnit = gananciaBaseDeProducto(ventaDraft.productId);
    const pUnit = cUnit + gUnit;

    const hora = ventaDraft.hora
      ? ventaDraft.hora.split(":").slice(0, 2).map(pad2).join(":")
      : "";

    const prod = productoPorId(ventaDraft.productId);

    const nueva = {
      id: String(uid()),
      productId: String(ventaDraft.productId),
      productNameSnapshot: prod ? prod.nombre : "",
      qty,
      place: ventaDraft.place.trim(),
      name: ventaDraft.name.trim(),
      dateISO: ventaDraft.dateISO,
      hora,
      color: "",
      obs: "",
      unitCost: cUnit,
      unitGain: gUnit,
      unitPrice: pUnit,
    };

    setVentas((xs) => [nueva, ...xs]); // ← no tocamos insumos
    setVentaDraft((d) => ({ ...d, qty: "", place: "", name: "", hora: "" }));
  };

  // ventas del mes, ordenadas por fecha/hora asc
  const ventasMes = [...ventas]
    .filter((v) => ym(v.dateISO) === mes)
    .sort((a, b) => {
      const d = a.dateISO.localeCompare(b.dateISO);
      if (d !== 0) return d;
      const ha = a.hora || "99:99";
      const hb = b.hora || "99:99";
      return ha.localeCompare(hb);
    });

  const totales = ventasMes.reduce(
    (acc, v) => {
      const cUnit =
        (v.unitCost ?? null) !== null
          ? v.unitCost
          : costoUnitDeProducto(v.productId);
      const g =
        (v.unitGain ?? null) !== null
          ? v.unitGain
          : gananciaBaseDeProducto(v.productId);
      const pUnit = (v.unitPrice ?? null) !== null ? v.unitPrice : cUnit + g;
      acc.costo += cUnit * v.qty;
      acc.venta += pUnit * v.qty;
      acc.gan += g * v.qty;
      return acc;
    },
    { costo: 0, venta: 0, gan: 0 }
  );
  const margenPct = totales.venta > 0 ? (totales.gan / totales.venta) * 100 : 0;

  // export CSV del mes
  const exportarCSV = () => {
    const rows = [
      [
        "Fecha",
        "Hora",
        "Lugar",
        "Color",
        "Nombre",
        "Producto",
        "Cantidad",
        "Costo unit.",
        "Ganancia",
        "Precio unit.",
        "Subtotal",
        "Observaciones",
      ],
    ];

    ventasMes.forEach((v) => {
      const p = productoPorId(v.productId);
      const nombreProd = v.productNameSnapshot || (p ? p.nombre : "—");
      const cUnit =
        (v.unitCost ?? null) !== null
          ? v.unitCost
          : costoUnitDeProducto(v.productId);
      const g =
        (v.unitGain ?? null) !== null
          ? v.unitGain
          : gananciaBaseDeProducto(v.productId);
      const pUnit = (v.unitPrice ?? null) !== null ? v.unitPrice : cUnit + g;
      const subtotal = pUnit * v.qty;

      rows.push([
        v.dateISO,
        v.hora || "",
        v.place || "",
        v.color || "",
        v.name || "",
        nombreProd,
        String(v.qty),
        String(cUnit.toFixed(2)),
        String(g.toFixed(2)),
        String(pUnit.toFixed(2)),
        String(subtotal.toFixed(2)),
        v.obs || "",
      ]);
    });

    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ventas_${mes}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ===================== MODAL DETALLE (ítems del ramo) ===================== */
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [ventaSel, setVentaSel] = useState(null);
  const abrirDetalle = (venta) => {
    setVentaSel(venta);
    setDetalleOpen(true);
  };
  const actualizarVentaCampo = (id, campo, valor) => {
    setVentas((xs) =>
      xs.map((v) => (v.id === id ? { ...v, [campo]: valor } : v))
    );
  };

  /* ===================== SELECCIÓN de ventas para HOJA ===================== */
  const [selVentas, setSelVentas] = useState(() => new Set());

  const toggleSelect = (id) =>
    setSelVentas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const clearSelection = () => setSelVentas(new Set());
  const selectAllThisMonth = () =>
    setSelVentas(new Set(ventasMes.map((v) => v.id)));

  const ventasSeleccionadas = ventasMes.filter((v) => selVentas.has(v.id));

  // Calcula líneas del detalle (para hoja y modal)
  const lineasDetalle = (venta) => {
    const p = productoPorId(venta.productId);
    const receta = p?.receta || [];
    return receta.map((r) => {
      const ins = insumoById.get(String(r.insumoId));
      const cantBase = toNum(r.cantidad);
      const cantTotal = cantBase * toNum(venta.qty);
      return {
        id: r.insumoId,
        nombre: ins ? ins.nombre : "—",
        cantTotal,
      };
    });
  };

  // Estilos impresión: ocultar todo menos la hoja
  const printSheet = () => {
    window.print();
  };

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "sans-serif",
        maxWidth: 1220,
        margin: "0 auto",
      }}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: avoid; }
          .sheet-block { margin-bottom: 18px; }
        }
      `}</style>

      <h1 className="no-print">📚 Inventario, Productos y Ventas</h1>

      {/* Tabs */}
      <div
        className="no-print"
        style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
      >
        <button
          onClick={() => setTab("insumos")}
          style={tabBtn(tab === "insumos")}
        >
          Insumos
        </button>
        <button
          onClick={() => setTab("productos")}
          style={tabBtn(tab === "productos")}
        >
          Productos
        </button>
        <button
          onClick={() => setTab("ventas")}
          style={tabBtn(tab === "ventas")}
        >
          Ventas
        </button>
      </div>

      {/* ===================== INSUMOS ===================== */}
      {tab === "insumos" && (
        <section className="no-print">
          <h2>📦 Insumos</h2>

          <div
            style={{
              marginBottom: 12,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <input
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <input
              type="number"
              step="any"
              placeholder="Cantidad"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
            <input
              type="number"
              step="any"
              placeholder="Precio"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
            <button onClick={agregarInsumo}>Agregar</button>
          </div>

          <table
            border="1"
            cellPadding="6"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => (
                <tr key={i.id}>
                  <td>
                    <input
                      value={i.nombre}
                      onChange={(e) =>
                        editarInsumo(i.id, "nombre", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      value={i.cantidad}
                      onChange={(e) =>
                        editarInsumo(i.id, "cantidad", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      value={i.precio}
                      onChange={(e) =>
                        editarInsumo(i.id, "precio", e.target.value)
                      }
                    />
                  </td>
                  <td>{currency.format(i.cantidad * i.precio)}</td>
                  <td>
                    <button onClick={() => eliminarInsumo(i.id)}>❌</button>
                  </td>
                </tr>
              ))}
              {insumos.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    style={{ textAlign: "center", color: "#666" }}
                  >
                    No hay insumos. Agrega algunos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h3 style={{ marginTop: 12 }}>
            💰 Valor total del inventario: {currency.format(totalInsumos)}
          </h3>
        </section>
      )}

      {/* ===================== PRODUCTOS ===================== */}
      {tab === "productos" && (
        <section className="no-print">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2>🧺 Productos (receta + ganancia)</h2>
            <button onClick={abrirNuevoProducto}>➕ Nuevo producto</button>
          </div>

          <table
            border="1"
            cellPadding="6"
            style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}
          >
            <thead>
              <tr>
                <th>Producto</th>
                <th>Costo unit.</th>
                <th>Ganancia (USD)</th>
                <th>Precio venta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const costo = costoProducto(p);
                const precioCalc =
                  p.ganancia !== "" && p.ganancia !== undefined
                    ? costo + Number(p.ganancia)
                    : p.precioVenta ?? "";
                return (
                  <tr key={p.id}>
                    <td>{p.nombre}</td>
                    <td>{currency.format(costo)}</td>
                    <td>
                      {p.ganancia === "" || p.ganancia === undefined
                        ? "—"
                        : currency.format(p.ganancia)}
                    </td>
                    <td>
                      {precioCalc === "" ? "—" : currency.format(precioCalc)}
                    </td>
                    <td>
                      <button onClick={() => abrirEditarProducto(p)}>
                        ✏️ Editar
                      </button>{" "}
                      <button onClick={() => eliminarProducto(p.id)}>
                        🗑️ Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {productos.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    style={{ textAlign: "center", color: "#666" }}
                  >
                    Crea un producto y define su receta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Modal crear/editar producto */}
          {pModalOpen && (
            <div style={overlay} onClick={() => setPModalOpen(false)}>
              <div style={modal} onClick={(e) => e.stopPropagation()}>
                <form onSubmit={guardarProducto}>
                  <h3 style={{ marginTop: 0 }}>
                    {editId ? "Editar producto" : "Nuevo producto"}
                  </h3>

                  <div style={{ display: "grid", gap: 8 }}>
                    <label>
                      Nombre
                      <input
                        value={draft.nombre}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, nombre: e.target.value }))
                        }
                      />
                    </label>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                      }}
                    >
                      <label>
                        Precio de venta (opcional)
                        <input
                          type="number"
                          step="any"
                          value={draft.precioVenta}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              precioVenta: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Ganancia fija (USD)
                        <input
                          type="number"
                          step="any"
                          value={draft.ganancia}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              ganancia: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <div style={{ fontWeight: 600 }}>
                        Costo actual: {currency.format(costoDraft)}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              precioVenta: (
                                costoDraft + toNum(d.ganancia)
                              ).toFixed(2),
                            }))
                          }
                        >
                          Usar sugerido:{" "}
                          {currency.format(costoDraft + toNum(draft.ganancia))}
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 6 }}>
                      <b>Receta</b>{" "}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            receta: [
                              ...(d.receta || []),
                              { insumoId: "", cantidad: "" },
                            ],
                          }))
                        }
                      >
                        ➕ Agregar insumo
                      </button>
                      {(!insumos || insumos.length === 0) && (
                        <div style={{ color: "#b00", marginTop: 6 }}>
                          No hay insumos definidos. Ve a la pestaña “Insumos”.
                        </div>
                      )}
                      <table
                        border="1"
                        cellPadding="6"
                        style={{
                          width: "100%",
                          marginTop: 8,
                          borderCollapse: "collapse",
                        }}
                      >
                        <thead>
                          <tr>
                            <th>Insumo</th>
                            <th>Precio</th>
                            <th>Cantidad por unidad</th>
                            <th>Subcosto</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(draft.receta || []).map((r, idx) => {
                            const ins = insumoById.get(String(r.insumoId));
                            const cant = parseFloat(r.cantidad) || 0;
                            const sub = (ins ? Number(ins.precio) : 0) * cant;
                            return (
                              <tr key={idx}>
                                <td>
                                  <select
                                    value={r.insumoId}
                                    onChange={(e) =>
                                      setDraft((d) => {
                                        const receta = [...d.receta];
                                        receta[idx] = {
                                          ...receta[idx],
                                          insumoId: e.target.value,
                                        };
                                        return { ...d, receta };
                                      })
                                    }
                                  >
                                    <option value="">— Selecciona —</option>
                                    {insumos.map((i) => (
                                      <option key={i.id} value={i.id}>
                                        {i.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  {ins ? currency.format(ins.precio) : "—"}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="any"
                                    value={r.cantidad}
                                    onChange={(e) =>
                                      setDraft((d) => {
                                        const receta = [...d.receta];
                                        receta[idx] = {
                                          ...receta[idx],
                                          cantidad: e.target.value,
                                        };
                                        return { ...d, receta };
                                      })
                                    }
                                  />
                                </td>
                                <td>{currency.format(sub)}</td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraft((d) => ({
                                        ...d,
                                        receta: d.receta.filter(
                                          (_, k) => k !== idx
                                        ),
                                      }))
                                    }
                                  >
                                    ❌
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {(draft.receta || []).length === 0 && (
                            <tr>
                              <td
                                colSpan="5"
                                style={{ textAlign: "center", color: "#666" }}
                              >
                                Agrega líneas de receta con “Agregar insumo”.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "flex-end",
                        marginTop: 10,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setPModalOpen(false)}
                      >
                        Cancelar
                      </button>
                      <button type="submit">Guardar</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===================== VENTAS (sin afectar inventario) ===================== */}
      {tab === "ventas" && (
        <section>
          <div
            className="no-print"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <h2>🧾 Ventas (mensual)</h2>
            <label>
              Mes:&nbsp;
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              />
            </label>
            <button onClick={exportarCSV}>⬇️ Exportar CSV (mes)</button>
          </div>

          {/* Resumen mensual */}
          <div
            className="no-print"
            style={{
              display: "flex",
              gap: 12,
              margin: "12px 0",
              flexWrap: "wrap",
            }}
          >
            <Badge
              title="Ventas del mes"
              value={currency.format(totales.venta)}
            />
            <Badge
              title="Costo insumos"
              value={currency.format(totales.costo)}
            />
            <Badge title="Ganancia" value={currency.format(totales.gan)} />
            <Badge title="Margen %" value={`${margenPct.toFixed(1)}%`} />
          </div>

          {/* Tabla ventas del mes con selección */}
          <table
            border="1"
            cellPadding="6"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th className="no-print">
                  <input
                    type="checkbox"
                    checked={
                      selVentas.size === ventasMes.length &&
                      ventasMes.length > 0
                    }
                    onChange={(e) =>
                      e.target.checked ? selectAllThisMonth() : clearSelection()
                    }
                  />
                </th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Costo unit.</th>
                <th>Ganancia</th>
                <th>Precio unit.</th>
                <th>Subtotal</th>
                <th className="no-print">Color</th>
                <th>Nombre</th>
                <th>Lugar</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Observaciones</th>
                <th className="no-print">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ventasMes.map((v) => {
                const p = productoPorId(v.productId);
                const cUnit =
                  (v.unitCost ?? null) !== null
                    ? v.unitCost
                    : p
                    ? costoProducto(p)
                    : 0;
                const g =
                  (v.unitGain ?? null) !== null
                    ? v.unitGain
                    : p
                    ? toNum(p.ganancia)
                    : 0;
                const pUnit =
                  (v.unitPrice ?? null) !== null ? v.unitPrice : cUnit + g;

                const rowStyle = v.color
                  ? {
                      background: `linear-gradient(0deg, ${v.color}${ALPHA}, ${v.color}${ALPHA})`,
                    }
                  : {};

                return (
                  <tr key={v.id} style={rowStyle}>
                    <td className="no-print" style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selVentas.has(v.id)}
                        onChange={() => toggleSelect(v.id)}
                      />
                    </td>
                    <td>{v.productNameSnapshot || (p ? p.nombre : "—")}</td>
                    <td>{v.qty}</td>
                    <td>{currency.format(cUnit)}</td>
                    <td>{currency.format(g)}</td>
                    <td>{currency.format(pUnit)}</td>
                    <td>{currency.format(pUnit * v.qty)}</td>

                    {/* Color presets + color picker (no-print) */}
                    <td className="no-print">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() =>
                              setVentas((xs) =>
                                xs.map((x) =>
                                  x.id === v.id ? { ...x, color: c } : x
                                )
                              )
                            }
                            title={`Usar ${c}`}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              border: "1px solid #aaa",
                              backgroundColor: c,
                              cursor: "pointer",
                            }}
                          />
                        ))}
                        <input
                          type="color"
                          value={v.color || "#ffffff"}
                          onChange={(e) =>
                            setVentas((xs) =>
                              xs.map((x) =>
                                x.id === v.id
                                  ? { ...x, color: e.target.value }
                                  : x
                              )
                            )
                          }
                          style={{
                            width: 28,
                            height: 28,
                            padding: 0,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                          title="Elegir color personalizado"
                        />
                        <button
                          onClick={() =>
                            setVentas((xs) =>
                              xs.map((x) =>
                                x.id === v.id ? { ...x, color: "" } : x
                              )
                            )
                          }
                          title="Quitar color"
                        >
                          ✖
                        </button>
                      </div>
                    </td>

                    <td>{v.name || "—"}</td>

                    {/* Lugar editable */}
                    <td>
                      <input
                        value={v.place || ""}
                        onChange={(e) =>
                          actualizarVentaCampo(v.id, "place", e.target.value)
                        }
                        placeholder="Lugar"
                        style={{ width: 160 }}
                      />
                    </td>

                    {/* Fecha editable */}
                    <td>
                      <input
                        type="date"
                        value={v.dateISO}
                        onChange={(e) =>
                          actualizarVentaCampo(v.id, "dateISO", e.target.value)
                        }
                        style={{ width: 140 }}
                      />
                    </td>

                    {/* Hora editable */}
                    <td>
                      <input
                        type="time"
                        value={v.hora || ""}
                        onChange={(e) =>
                          actualizarVentaCampo(v.id, "hora", e.target.value)
                        }
                        style={{ width: 110 }}
                      />
                    </td>

                    {/* Observaciones */}
                    <td>
                      <input
                        value={v.obs || ""}
                        onChange={(e) =>
                          actualizarVentaCampo(v.id, "obs", e.target.value)
                        }
                        placeholder="Notas…"
                        style={{ width: 220 }}
                      />
                    </td>

                    <td className="no-print">
                      <button onClick={() => abrirDetalle(v)}>
                        🧾 Detalle
                      </button>{" "}
                      <button
                        onClick={() =>
                          setVentas((xs) => xs.filter((x) => x.id !== v.id))
                        }
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
              {ventasMes.length === 0 && (
                <tr>
                  <td
                    colSpan="14"
                    style={{ textAlign: "center", color: "#666" }}
                  >
                    No hay ventas este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Controles de selección */}
          <div
            className="no-print"
            style={{ display: "flex", gap: 8, marginTop: 10 }}
          >
            <button onClick={selectAllThisMonth}>Seleccionar todo (mes)</button>
            <button onClick={clearSelection}>Limpiar selección</button>
            {ventasSeleccionadas.length > 0 && (
              <button onClick={printSheet}>🖨️ Imprimir hoja</button>
            )}
          </div>

          {/* --------- Hoja apilada con los seleccionados --------- */}
          {ventasSeleccionadas.length > 0 && (
            <div className="print-area" style={{ marginTop: 16 }}>
              {ventasSeleccionadas.map((v) => {
                const p = productoPorId(v.productId);
                const nombreRamo =
                  v.productNameSnapshot || (p ? p.nombre : "—");
                const lineas = lineasDetalle(v);
                return (
                  <div
                    key={v.id}
                    className="sheet-block"
                    style={{ marginBottom: 24 }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      Nombre del ramo:{" "}
                      <span style={{ fontWeight: 400 }}>{nombreRamo}</span>
                    </div>
                    <table
                      border="1"
                      cellPadding="6"
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          <th>Insumos</th>
                          <th>Cantidad Total</th>
                          <th>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineas.length === 0 ? (
                          <tr>
                            <td
                              colSpan="3"
                              style={{ textAlign: "center", color: "#666" }}
                            >
                              Este producto no tiene receta definida.
                            </td>
                          </tr>
                        ) : (
                          lineas.map((L, idx) => (
                            <tr key={String(L.id) + "_" + idx}>
                              <td>{L.nombre}</td>
                              <td>{L.cantTotal}</td>
                              {/* Observaciones solo una vez, usando rowSpan */}
                              {idx === 0 && (
                                <td
                                  rowSpan={lineas.length}
                                  style={{ verticalAlign: "top", width: "45%" }}
                                >
                                  {v.obs || ""}
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {/* --------- Modal Detalle (individual) --------- */}
          {detalleOpen &&
            ventaSel &&
            (() => {
              const v = ventaSel;
              const p = productoPorId(v.productId);
              const nombreRamo = v.productNameSnapshot || (p ? p.nombre : "—");
              const fechaTexto = v.dateISO + (v.hora ? ` ${v.hora}` : "");
              const receta = p?.receta || [];

              const lineas = receta.map((r) => {
                const ins = insumoById.get(String(r.insumoId));
                const cantBase = toNum(r.cantidad);
                const cantTotal = cantBase * toNum(v.qty);
                const precioIns = ins ? toNum(ins.precio) : 0;
                const sub = cantTotal * precioIns;
                return {
                  id: r.insumoId,
                  nombre: ins ? ins.nombre : "—",
                  precio: precioIns,
                  cantTotal,
                  sub,
                };
              });

              const totalDetalle = lineas.reduce((acc, L) => acc + L.sub, 0);

              return (
                <div style={overlay} onClick={() => setDetalleOpen(false)}>
                  <div style={modal} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                      Detalle del ramo
                    </h3>

                    <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                      <div>
                        <b>Nombre del ramo:</b> {nombreRamo}
                      </div>
                      <div>
                        <b>Persona:</b> {v.name || "—"}
                      </div>
                      <div>
                        <b>Fecha:</b> {fechaTexto}
                      </div>
                    </div>

                    <table
                      border="1"
                      cellPadding="6"
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        marginBottom: 10,
                      }}
                    >
                      <thead>
                        <tr>
                          <th>Insumo</th>
                          <th>Precio (unit.)</th>
                          <th>Cantidad total</th>
                          <th>Subcosto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineas.length === 0 ? (
                          <tr>
                            <td
                              colSpan="4"
                              style={{ textAlign: "center", color: "#666" }}
                            >
                              Este producto no tiene receta definida.
                            </td>
                          </tr>
                        ) : (
                          lineas.map((L, idx) => (
                            <tr key={String(L.id) + "_" + idx}>
                              <td>{L.nombre}</td>
                              <td>{currency.format(L.precio)}</td>
                              <td>{L.cantTotal}</td>
                              <td>{currency.format(L.sub)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {lineas.length > 0 && (
                        <tfoot>
                          <tr>
                            <th colSpan="3" style={{ textAlign: "right" }}>
                              Total insumos
                            </th>
                            <th>{currency.format(totalDetalle)}</th>
                          </tr>
                        </tfoot>
                      )}
                    </table>

                    {/* Observaciones sincronizadas con la tabla */}
                    <div style={{ marginTop: 6, marginBottom: 12 }}>
                      <label style={{ display: "block", marginBottom: 6 }}>
                        <b>Observaciones</b>
                      </label>
                      <textarea
                        value={v.obs || ""}
                        onChange={(e) =>
                          actualizarVentaCampo(v.id, "obs", e.target.value)
                        }
                        placeholder="Notas, pedidos especiales…"
                        rows={4}
                        style={{ width: "100%", resize: "vertical" }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                      }}
                    >
                      <button onClick={() => setDetalleOpen(false)}>
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
        </section>
      )}
    </div>
  );
}
