import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bike, Check, Clock, Lock, MapPin, Package, Store, Truck } from 'lucide-react';
import { Cargando, ErrorMensaje } from '../components/Estados.jsx';
import { useCarrito } from '../context/CarritoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { api } from '../lib/api.js';
import { guardarCompraInvitado } from '../lib/comprasInvitado.js';
import { etiquetaDe, useReferencias, useTitulo } from '../lib/hooks.js';
import { imagen, plural, precio } from '../lib/formato.js';

const ICONOS_TRANSPORTE = { andreani: Truck, oca: Truck, correo_argentino: Package, moto: Bike };

function validarComprador(c) {
  const e = {};
  if (c.nombre.trim().length < 2) e.nombre = 'Ingresá tu nombre.';
  if (c.apellido.trim().length < 2) e.apellido = 'Ingresá tu apellido.';
  if (!/^\S+@\S+\.\S+$/.test(c.email.trim())) e.email = 'Ingresá un email válido.';
  if (!/^[0-9+()\s-]{6,30}$/.test(c.telefono.trim())) e.telefono = 'Ingresá un teléfono válido (solo números, espacios y guiones).';
  if (!/^[0-9]{7,8}$/.test(c.dni.trim())) e.dni = 'El DNI tiene 7 u 8 números, sin puntos.';
  return e;
}

function validarDireccion(d) {
  const e = {};
  if (d.calle.trim().length < 2) e.calle = 'Ingresá la calle.';
  if (!d.numero.trim()) e.numero = 'Ingresá el número.';
  if (!/^[A-Za-z]?[0-9]{4}[A-Za-z]{0,3}$/.test(d.codigo_postal.trim())) e.codigo_postal = 'Código postal inválido (ej: 5000 o X5000ABC).';
  if (d.localidad.trim().length < 2) e.localidad = 'Ingresá la localidad.';
  if (!d.provincia) e.provincia = 'Elegí la provincia.';
  return e;
}

function Campo({ id, etiqueta, error, children, ancho, opcional }) {
  return (
    <div className={`campo ${ancho ? 'ancho-total' : ''}`}>
      <label htmlFor={id}>{etiqueta}{opcional && <small className="texto-gris"> (opcional)</small>}</label>
      {children}
      {error && <span className="campo__error">{error}</span>}
    </div>
  );
}

export default function Checkout() {
  useTitulo('Finalizar compra');
  const referencias = useReferencias();
  const transportista = (valor) => etiquetaDe(referencias, 'transportistas', valor);
  const { usuario } = useAuth();
  const { grupos, items, sincronizar, vaciar } = useCarrito();
  const { avisar } = useAvisos();
  const navegar = useNavigate();

  const [listo, setListo] = useState(false);
  const [avisosCarrito, setAvisosCarrito] = useState([]);
  const [paso, setPaso] = useState(0);
  const [comprador, setComprador] = useState({ nombre: '', apellido: '', email: '', telefono: '', dni: '' });
  // Con sesión se precargan los datos de la cuenta (sin pisar lo que ya se escribió)
  useEffect(() => {
    if (!usuario) return;
    setComprador((c) => ({
      nombre: c.nombre || usuario.nombre || '', apellido: c.apellido || usuario.apellido || '', email: c.email || usuario.email || '',
      telefono: c.telefono || usuario.telefono || '', dni: c.dni || usuario.dni || '',
    }));
  }, [usuario]);
  const [entregas, setEntregas] = useState({});
  const [direccion, setDireccion] = useState({
    calle: '', numero: '', piso_depto: '', codigo_postal: '', localidad: '', provincia: '', observaciones: '',
  });
  const [errores, setErrores] = useState({});
  const [cotizaciones, setCotizaciones] = useState({});
  const [cotizando, setCotizando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [errorPago, setErrorPago] = useState(null);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [pagando, setPagando] = useState(false);

  // Precios, stock y datos de retiro reales antes de empezar.
  useEffect(() => {
    sincronizar().then(setAvisosCarrito).catch(() => {}).finally(() => setListo(true));
  }, [sincronizar]);

  const conEnvio = grupos.filter((g) => entregas[g.vendedor.id]?.metodo === 'domicilio');
  const pasos = ['Tus datos', 'Entrega', ...(conEnvio.length ? ['Envío'] : []), 'Resumen'];
  const nombrePaso = pasos[paso];

  // Cotiza los envíos cuando la dirección tiene provincia y localidad.
  const claveCotizacion = useMemo(
    () => JSON.stringify([direccion.provincia, direccion.localidad.trim(), conEnvio.map((g) => [g.vendedor.id, g.unidades])]),
    [direccion.provincia, direccion.localidad, conEnvio],
  );
  useEffect(() => {
    if (nombrePaso !== 'Envío' || !direccion.provincia || direccion.localidad.trim().length < 2) return undefined;
    const temporizador = setTimeout(async () => {
      setCotizando(true);
      setErrorEnvio(null);
      try {
        const resultados = await Promise.all(conEnvio.map((g) => api('/envios/cotizar', {
          method: 'POST',
          body: { vendedor_id: g.vendedor.id, provincia: direccion.provincia, localidad: direccion.localidad.trim(), unidades: g.unidades },
        })));
        const nuevas = {};
        resultados.forEach((r) => { nuevas[r.vendedor.id] = r; });
        setCotizaciones(nuevas);
        // Si el transportista elegido dejó de estar disponible (ej: moto fuera de la ciudad) se deselecciona.
        setEntregas((actual) => {
          const copia = { ...actual };
          for (const [vid, r] of Object.entries(nuevas)) {
            const elegido = copia[vid]?.transportista;
            if (elegido && !r.opciones.find((o) => o.transportista === elegido)?.disponible) copia[vid] = { ...copia[vid], transportista: null };
          }
          return copia;
        });
      } catch (err) {
        setErrorEnvio(err);
      } finally {
        setCotizando(false);
      }
    }, 450);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveCotizacion, nombrePaso]);

  if (!listo) return <div className="contenedor pagina"><Cargando texto="Preparando tu compra…" /></div>;
  if (!items.length && !pagando) return <Navigate to="/carrito" replace />;

  const costoEnvio = (vid) => {
    const e = entregas[vid];
    if (e?.metodo !== 'domicilio' || !e.transportista) return 0;
    return cotizaciones[vid]?.opciones.find((o) => o.transportista === e.transportista)?.costo || 0;
  };
  const subtotal = grupos.reduce((s, g) => s + g.subtotal, 0);
  const totalEnvios = grupos.reduce((s, g) => s + costoEnvio(g.vendedor.id), 0);

  const siguiente = () => {
    let encontrados = {};
    if (nombrePaso === 'Tus datos') encontrados = validarComprador(comprador);
    if (nombrePaso === 'Entrega') {
      for (const g of grupos) if (!entregas[g.vendedor.id]?.metodo) encontrados[`entrega-${g.vendedor.id}`] = 'Elegí cómo querés recibir este pedido.';
    }
    if (nombrePaso === 'Envío') {
      encontrados = validarDireccion(direccion);
      for (const g of conEnvio) if (!entregas[g.vendedor.id]?.transportista) encontrados[`transporte-${g.vendedor.id}`] = 'Elegí un transportista.';
    }
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;
    setPaso((p) => p + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const atras = () => {
    setErrores({});
    setPaso((p) => Math.max(0, p - 1));
  };

  const pagar = async () => {
    setErrorPago(null);
    if (!aceptaTerminos) {
      setErrores((e) => ({ ...e, acepta: 'Para pagar tenés que aceptar los términos y condiciones.' }));
      return;
    }
    setPagando(true);
    try {
      const respuesta = await api('/compras', {
        method: 'POST',
        body: {
          comprador,
          items: items.map(({ publicacion_id, cantidad }) => ({ publicacion_id, cantidad })),
          entregas: grupos.map((g) => ({ vendedor_id: g.vendedor.id, ...entregas[g.vendedor.id], transportista: entregas[g.vendedor.id].transportista || undefined })),
          direccion: conEnvio.length ? direccion : undefined,
        },
      });
      // Compra sin cuenta: esta pestaña guarda su código (hasta cerrarla) para pagarla, volver de Mercado Pago y ver el comprobante
      if (respuesta.codigo_acceso) guardarCompraInvitado(respuesta.compra_id, respuesta.codigo_acceso);
      vaciar();
      if (respuesta.pago?.init_point) {
        window.location.href = respuesta.pago.init_point;
        return;
      }
      avisar(`Tu compra #${respuesta.compra_id} quedó registrada, pero no pudimos abrir Mercado Pago.`, 'error', 7000);
      if (respuesta.codigo_acceso) navegar(`/seguir-compra?compra=${respuesta.compra_id}`);
      else navegar('/mis-compras', { state: { compraId: respuesta.compra_id, errorPago: respuesta.error_pago } });
    } catch (err) {
      setErrorPago(err);
      setPagando(false);
      if (err.status === 409) sincronizar().then(setAvisosCarrito).catch(() => {});
    }
  };

  const setCampo = (setter, nombre) => (e) => setter((d) => ({ ...d, [nombre]: e.target.value }));

  return (
    <div className="contenedor pagina checkout">
      <h1 className="titulo-seccion">Finalizar compra</h1>
      <ol className="stepper" aria-label="Pasos de la compra">
        {pasos.map((p, i) => (
          <li key={p} className={i < paso ? 'hecho' : i === paso ? 'actual' : ''} aria-current={i === paso ? 'step' : undefined}>
            <span className="stepper__num">{i < paso ? <Check size={14} /> : i + 1}</span>{p}
          </li>
        ))}
      </ol>

      {avisosCarrito.length > 0 && (
        <div className="alerta alerta--aviso"><div><strong>Actualizamos tu carrito:</strong><ul>{avisosCarrito.map((m) => <li key={m}>{m}</li>)}</ul></div></div>
      )}

      <div className="checkout__grilla">
        <div className="checkout__paso tarjeta tarjeta--padding">
          {nombrePaso === 'Tus datos' && (
            <>
              <h2>¿Quién recibe la compra?</h2>
              <p className="texto-gris">Usamos estos datos para la factura del vendedor y para coordinar la entrega.</p>
              {!usuario && (
                <p className="alerta alerta--info checkout__invitado">
                  <span>
                    Estás comprando <strong>sin cuenta</strong>: con el número de compra y este email la podés seguir desde
                    “Seguí tu compra”. ¿Ya tenés cuenta? <Link to="/ingresar" state={{ desde: '/checkout' }}>Iniciá sesión</Link> y
                    la compra queda en “Mis compras”.
                  </span>
                </p>
              )}
              <div className="grilla-form">
                <Campo id="nombre" etiqueta="Nombre" error={errores.nombre}><input id="nombre" className="input" value={comprador.nombre} onChange={setCampo(setComprador, 'nombre')} autoComplete="given-name" /></Campo>
                <Campo id="apellido" etiqueta="Apellido" error={errores.apellido}><input id="apellido" className="input" value={comprador.apellido} onChange={setCampo(setComprador, 'apellido')} autoComplete="family-name" /></Campo>
                <Campo id="email" etiqueta="Email" error={errores.email}><input id="email" type="email" className="input" value={comprador.email} onChange={setCampo(setComprador, 'email')} autoComplete="email" /></Campo>
                <Campo id="telefono" etiqueta="Teléfono" error={errores.telefono}><input id="telefono" type="tel" className="input" value={comprador.telefono} onChange={setCampo(setComprador, 'telefono')} autoComplete="tel" placeholder="11 5555-0101" /></Campo>
                <Campo id="dni" etiqueta="DNI" error={errores.dni}><input id="dni" inputMode="numeric" className="input" value={comprador.dni} onChange={setCampo(setComprador, 'dni')} placeholder="30123456" /></Campo>
              </div>
            </>
          )}

          {nombrePaso === 'Entrega' && (
            <>
              <h2>¿Cómo querés recibir cada pedido?</h2>
              <p className="texto-gris">Tu compra se divide en {plural(grupos.length, 'pedido', 'pedidos')}, uno por vendedor. Elegí la entrega de cada uno.</p>
              <div className="pila">
                {grupos.map((g) => {
                  const e = entregas[g.vendedor.id] || {};
                  const elegir = (metodo) => setEntregas((a) => ({ ...a, [g.vendedor.id]: { metodo, transportista: metodo === 'domicilio' ? a[g.vendedor.id]?.transportista || null : null } }));
                  return (
                    <fieldset key={g.vendedor.id} className="entrega">
                      <legend><Store size={18} /> {g.vendedor.nombre_comercial} <small className="texto-gris">· {plural(g.unidades, 'producto', 'productos')} · {g.vendedor.ciudad}, {g.vendedor.provincia}</small></legend>
                      <div className="entrega__opciones">
                        <label className={`opcion-entrega ${e.metodo === 'retiro' ? 'activa' : ''}`}>
                          <input type="radio" name={`entrega-${g.vendedor.id}`} checked={e.metodo === 'retiro'} onChange={() => elegir('retiro')} />
                          <span className="opcion-entrega__icono"><Store size={22} /></span>
                          <span className="opcion-entrega__texto">
                            <strong>Retiro en el local <span className="gratis">Gratis</span></strong>
                            <span><MapPin size={14} /> {g.vendedor.direccion}, {g.vendedor.ciudad}, {g.vendedor.provincia}</span>
                            <span><Clock size={14} /> {g.vendedor.horario}</span>
                          </span>
                        </label>
                        <label className={`opcion-entrega ${e.metodo === 'domicilio' ? 'activa' : ''}`}>
                          <input type="radio" name={`entrega-${g.vendedor.id}`} checked={e.metodo === 'domicilio'} onChange={() => elegir('domicilio')} />
                          <span className="opcion-entrega__icono"><Truck size={22} /></span>
                          <span className="opcion-entrega__texto">
                            <strong>Envío a domicilio</strong>
                            <span>Andreani, OCA, Correo Argentino o moto mensajería si estás en {g.vendedor.ciudad}.</span>
                          </span>
                        </label>
                      </div>
                      {errores[`entrega-${g.vendedor.id}`] && <span className="campo__error">{errores[`entrega-${g.vendedor.id}`]}</span>}
                    </fieldset>
                  );
                })}
              </div>
            </>
          )}

          {nombrePaso === 'Envío' && (
            <>
              <h2>Dirección de envío</h2>
              <div className="grilla-form">
                <Campo id="calle" etiqueta="Calle" error={errores.calle}><input id="calle" className="input" value={direccion.calle} onChange={setCampo(setDireccion, 'calle')} autoComplete="address-line1" /></Campo>
                <div className="grilla-form grilla-form--anidada">
                  <Campo id="numero" etiqueta="Número" error={errores.numero}><input id="numero" className="input" value={direccion.numero} onChange={setCampo(setDireccion, 'numero')} /></Campo>
                  <Campo id="piso_depto" etiqueta="Piso / Depto" opcional><input id="piso_depto" className="input" value={direccion.piso_depto} onChange={setCampo(setDireccion, 'piso_depto')} /></Campo>
                </div>
                <Campo id="codigo_postal" etiqueta="Código postal" error={errores.codigo_postal}><input id="codigo_postal" className="input" value={direccion.codigo_postal} onChange={setCampo(setDireccion, 'codigo_postal')} autoComplete="postal-code" placeholder="5000" /></Campo>
                <Campo id="localidad" etiqueta="Localidad" error={errores.localidad}><input id="localidad" className="input" value={direccion.localidad} onChange={setCampo(setDireccion, 'localidad')} autoComplete="address-level2" placeholder="Córdoba" /></Campo>
                <Campo id="provincia" etiqueta="Provincia" error={errores.provincia}>
                  <select id="provincia" className="select" value={direccion.provincia} onChange={setCampo(setDireccion, 'provincia')}>
                    <option value="">Elegí…</option>
                    {referencias?.provincias.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Campo>
                <Campo id="observaciones" etiqueta="Observaciones" opcional ancho>
                  <textarea id="observaciones" className="textarea" value={direccion.observaciones} onChange={setCampo(setDireccion, 'observaciones')} placeholder="Timbre, entre calles, horario en el que hay alguien…" />
                </Campo>
              </div>

              <h2 className="checkout__subtitulo">Transportista</h2>
              {(!direccion.provincia || direccion.localidad.trim().length < 2) && (
                <p className="alerta alerta--info">Completá la localidad y la provincia para ver los costos y demoras de envío.</p>
              )}
              {cotizando && <Cargando texto="Cotizando envíos…" />}
              <ErrorMensaje error={errorEnvio} />
              {conEnvio.map((g) => {
                const cot = cotizaciones[g.vendedor.id];
                if (!cot) return null;
                const elegido = entregas[g.vendedor.id]?.transportista;
                return (
                  <fieldset key={g.vendedor.id} className="entrega">
                    <legend><Store size={18} /> {g.vendedor.nombre_comercial} <small className="texto-gris">· despacha desde {g.vendedor.ciudad}, {g.vendedor.provincia}</small></legend>
                    <p className="texto-chico texto-gris">{cot.misma_provincia ? 'El destino está en la misma provincia que el vendedor.' : 'El destino está en otra provincia: aplica tarifa interprovincial.'}</p>
                    <div className="transportistas">
                      {cot.opciones.map((o) => {
                        const Icono = ICONOS_TRANSPORTE[o.transportista];
                        return (
                          <label key={o.transportista} className={`transportista ${elegido === o.transportista ? 'activa' : ''} ${!o.disponible ? 'deshabilitada' : ''}`}>
                            <input type="radio" name={`transporte-${g.vendedor.id}`} disabled={!o.disponible} checked={elegido === o.transportista}
                              onChange={() => setEntregas((a) => ({ ...a, [g.vendedor.id]: { metodo: 'domicilio', transportista: o.transportista } }))} />
                            <Icono size={22} aria-hidden="true" />
                            <span className="transportista__texto">
                              <strong>{o.nombre}</strong>
                              <small>{o.disponible ? o.demora : o.motivo}</small>
                            </span>
                            <span className="transportista__costo">{o.disponible ? precio(o.costo) : 'No disponible'}</span>
                          </label>
                        );
                      })}
                    </div>
                    {errores[`transporte-${g.vendedor.id}`] && <span className="campo__error">{errores[`transporte-${g.vendedor.id}`]}</span>}
                  </fieldset>
                );
              })}
            </>
          )}

          {nombrePaso === 'Resumen' && (
            <>
              <h2>Revisá tu compra</h2>
              <div className="resumen-datos">
                <div><small>Comprador</small><strong>{comprador.nombre} {comprador.apellido}</strong><span>DNI {comprador.dni} · {comprador.telefono}</span><span>{comprador.email}</span></div>
                {conEnvio.length > 0 && (
                  <div><small>Envío a</small><strong>{direccion.calle} {direccion.numero}{direccion.piso_depto ? `, ${direccion.piso_depto}` : ''}</strong><span>{direccion.localidad}, {direccion.provincia} ({direccion.codigo_postal})</span></div>
                )}
              </div>
              {grupos.map((g) => {
                const e = entregas[g.vendedor.id];
                const opcion = cotizaciones[g.vendedor.id]?.opciones.find((o) => o.transportista === e.transportista);
                return (
                  <section key={g.vendedor.id} className="resumen-pedido">
                    <header><Store size={18} /> <strong>{g.vendedor.nombre_comercial}</strong></header>
                    <ul>
                      {g.items.map((i) => (
                        <li key={i.publicacion_id}>
                          <img src={imagen(i.producto.imagen)} alt="" />
                          <span>{i.cantidad} × {i.producto.nombre} <small className="texto-gris">({i.condicion}, {i.producto.numero_pieza})</small></span>
                          <strong>{precio(i.precio * i.cantidad)}</strong>
                        </li>
                      ))}
                    </ul>
                    <div className="resumen-pedido__entrega">
                      {e.metodo === 'retiro' ? (
                        <><span><Store size={15} /> Retiro en el local: {g.vendedor.direccion}, {g.vendedor.ciudad} · {g.vendedor.horario}</span><strong>Gratis</strong></>
                      ) : (
                        <><span><Truck size={15} /> Envío por {transportista(e.transportista)} · {opcion?.demora}</span><strong>{precio(opcion?.costo)}</strong></>
                      )}
                    </div>
                  </section>
                );
              })}
              <label className="check legal__acepto">
                <input type="checkbox" checked={aceptaTerminos} aria-invalid={errores.acepta ? 'true' : undefined}
                  onChange={(e) => { setAceptaTerminos(e.target.checked); setErrores(({ acepta, ...resto }) => resto); }} />
                <span>
                  Leí y acepto los <Link to="/terminos" target="_blank" className="enlace">Términos y condiciones</Link> y la
                  {' '}<Link to="/privacidad" target="_blank" className="enlace">Política de privacidad</Link>. Tenés 10 días para
                  arrepentirte de la compra.
                </span>
              </label>
              {errores.acepta && <span className="campo__error">{errores.acepta}</span>}
              <ErrorMensaje error={errorPago} titulo="No pudimos crear la compra" />
            </>
          )}

          <div className="checkout__navegacion">
            {paso > 0 ? <button type="button" className="btn" onClick={atras} disabled={pagando}><ArrowLeft size={16} /> Volver</button> : <Link to="/carrito" className="btn"><ArrowLeft size={16} /> Carrito</Link>}
            {nombrePaso !== 'Resumen' ? (
              <button type="button" className="btn btn--primario" onClick={siguiente} disabled={nombrePaso === 'Envío' && cotizando}>Continuar <ArrowRight size={16} /></button>
            ) : (
              <button type="button" className="btn btn--mp" onClick={pagar} disabled={pagando}>
                <Lock size={18} /> {pagando ? 'Conectando con Mercado Pago…' : `Pagar ${precio(subtotal + totalEnvios)} con Mercado Pago`}
              </button>
            )}
          </div>
        </div>

        <aside className="tarjeta tarjeta--padding resumen-compra">
          <h2>Tu compra</h2>
          {grupos.map((g) => (
            <div key={g.vendedor.id} className="resumen-compra__bloque">
              <div className="resumen-compra__fila"><strong>{g.vendedor.nombre_comercial}</strong><span>{precio(g.subtotal)}</span></div>
              <div className="resumen-compra__fila texto-gris texto-chico">
                <span>{!entregas[g.vendedor.id]?.metodo ? 'Entrega a definir' : entregas[g.vendedor.id].metodo === 'retiro' ? 'Retiro en el local' : entregas[g.vendedor.id].transportista ? `Envío ${transportista(entregas[g.vendedor.id].transportista)}` : 'Envío a domicilio'}</span>
                <span>{entregas[g.vendedor.id]?.metodo === 'retiro' ? 'Gratis' : costoEnvio(g.vendedor.id) ? precio(costoEnvio(g.vendedor.id)) : '—'}</span>
              </div>
            </div>
          ))}
          <div className="resumen-compra__fila"><span>Productos</span><span>{precio(subtotal)}</span></div>
          <div className="resumen-compra__fila"><span>Envíos</span><span>{precio(totalEnvios)}</span></div>
          <div className="resumen-compra__total"><span>Total</span><strong>{precio(subtotal + totalEnvios)}</strong></div>
          <p className="texto-mini texto-gris"><Lock size={12} /> Pagás de forma segura en Mercado Pago. El total final lo calcula AUTONEX con los precios y stock vigentes.</p>
        </aside>
      </div>
    </div>
  );
}
