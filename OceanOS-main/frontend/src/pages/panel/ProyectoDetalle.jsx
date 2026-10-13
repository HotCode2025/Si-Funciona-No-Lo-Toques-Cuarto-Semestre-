import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { useOrg } from '../../hooks/useOrg.js';
import { api } from '../../services/api.js';
import {
  Panel, Barra, Boton, Campo, Entrada, Selector, Cargando, CajaError, Etiqueta, Sonda, Vacio,
} from '../../components/ui/index.jsx';
import { numero, fecha, ESTADO_PROYECTO } from '../../utils/format.js';

const REGISTROS = { verra: 'Verra', gold_standard: 'Gold Standard', interno: 'Interno' };
const ESTADO_CREDITO = {
  borrador: 'Borrador', en_validacion: 'En validación',
  certificado: 'Certificado', retirado: 'Retirado',
};

export default function ProyectoDetalle() {
  const { id } = useParams();
  const org = useOrg();
  const ruta = org ? `/organizaciones/${org.id}/proyectos/${id}` : null;
  const { data, error, loading, recargar } = useFetch(ruta, [org?.id, id]);

  const [hito, setHito] = useState({ title: '', dueOn: '' });
  const [agregando, setAgregando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState(null);
  const [hectareas, setHectareas] = useState(null);

  if (loading) return <div className="mx-auto max-w-3xl px-5 py-6"><Cargando /></div>;
  if (error)   return <div className="mx-auto max-w-3xl px-5 py-6"><CajaError error={error} onReintentar={recargar} /></div>;

  const p = data.proyecto;

  const agregarHito = async (evento) => {
    evento.preventDefault();
    setGuardando(true); setFalla(null);
    try {
      await api.post(`/organizaciones/${org.id}/proyectos/${id}/hitos`, {
        title: hito.title, dueOn: hito.dueOn || undefined,
      });
      setHito({ title: '', dueOn: '' });
      setAgregando(false);
      recargar();
    } catch (e) { setFalla(e); } finally { setGuardando(false); }
  };

  const alternarHito = async (milestoneId, hecho) => {
    setFalla(null);
    try {
      await api.patch(`/organizaciones/${org.id}/hitos/${milestoneId}`, { done: hecho });
      recargar();
    } catch (e) { setFalla(e); }
  };

  const cambiarEstado = async (status) => {
    setFalla(null);
    try { await api.patch(ruta, { status }); recargar(); } catch (e) { setFalla(e); }
  };

  const guardarHectareas = async () => {
    setFalla(null);
    try { await api.patch(ruta, { hectares: Number(hectareas) }); setHectareas(null); recargar(); }
    catch (e) { setFalla(e); }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 lg:px-8">
      <Link to="/panel/proyectos" className="inline-flex items-center gap-1.5 text-sm text-tinta hover:text-kelp">
        <ArrowLeft size={14} /> Proyectos
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-600">{p.name}</h1>
          <Link to={`/ecosistema/${p.zone_slug}`}
                className="mt-1 inline-block text-sm text-tinta/80 underline underline-offset-4 hover:text-kelp">
            {p.zone_name}
          </Link>
        </div>
        <Selector value={p.status} onChange={(e) => cambiarEstado(e.target.value)} className="max-w-44">
          {Object.entries(ESTADO_PROYECTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Selector>
      </div>

      {p.description && <p className="mt-4 text-[15px] leading-relaxed text-tinta">{p.description}</p>}
      {falla && <div className="mt-4"><CajaError error={falla} /></div>}

      <div className="mt-6 grid grid-cols-2 gap-6 border-y border-trazo py-6 lg:grid-cols-4">
        <Sonda valor={numero(p.hectares, 1)} unidad="ha" rotulo="restauradas" color="var(--color-kelp)" />
        <Sonda valor={numero(p.target_hectares, 1)} unidad="ha" rotulo="objetivo" />
        <Sonda valor={`${p.hitos_cumplidos}/${p.hitos}`} rotulo="hitos cumplidos" />
        <Sonda valor={numero(p.tco2_certificado)} unidad="tCO₂e" rotulo="certificadas" color="var(--color-alga)" />
      </div>

      {p.target_hectares > 0 && (
        <div className="mt-5">
          <Barra valor={p.avance_pct ?? 0} />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-tinta/70">Actualizar hectáreas restauradas:</span>
            {hectareas === null ? (
              <button onClick={() => setHectareas(p.hectares)}
                      className="underline underline-offset-4 hover:text-kelp">editar</button>
            ) : (
              <span className="inline-flex items-center gap-2">
                <input type="number" step="0.1" min="0" value={hectareas}
                       onChange={(e) => setHectareas(e.target.value)}
                       className="w-24 rounded-carta border border-trazo px-2 py-1 text-sm" />
                <Boton variante="kelp" className="px-3 py-1 text-xs" onClick={guardarHectareas}>Guardar</Boton>
                <button onClick={() => setHectareas(null)} className="text-xs underline">cancelar</button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Hitos */}
      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-600">Hitos</h2>
          <Boton variante="linea" className="py-1.5 text-xs" onClick={() => setAgregando(!agregando)}>
            {agregando ? 'Cancelar' : <><Plus size={13} /> Agregar</>}
          </Boton>
        </div>

        {agregando && (
          <Panel className="mt-3 p-4">
            <form onSubmit={agregarHito} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <Campo etiqueta="Hito" requerido>
                <Entrada required minLength={2} value={hito.title}
                         onChange={(e) => setHito({ ...hito, title: e.target.value })} />
              </Campo>
              <Campo etiqueta="Fecha límite">
                <Entrada type="date" value={hito.dueOn}
                         onChange={(e) => setHito({ ...hito, dueOn: e.target.value })} />
              </Campo>
              <Boton type="submit" variante="kelp" cargando={guardando}>Agregar</Boton>
            </form>
          </Panel>
        )}

        {p.hitos_lista?.length ? (
          <div className="mt-3 divide-y divide-trazo border-y border-trazo">
            {p.hitos_lista.map((h) => (
              <label key={h.id} className="flex cursor-pointer items-center gap-3 py-3">
                <input type="checkbox" checked={!!h.done_on}
                       onChange={(e) => alternarHito(h.id, e.target.checked)}
                       className="h-4 w-4 accent-[var(--color-kelp)]" />
                <span className={`flex-1 text-sm ${h.done_on ? 'text-tinta/60 line-through' : ''}`}>
                  {h.title}
                </span>
                <span className="text-xs text-tinta/70">
                  {h.done_on ? `hecho ${fecha(h.done_on)}` : h.due_on ? fecha(h.due_on) : '—'}
                </span>
              </label>
            ))}
          </div>
        ) : !agregando && (
          <Panel className="mt-3"><Vacio titulo="Sin hitos cargados"
            detalle="Los hitos son lo que después se exporta a los informes para BID o GEF." /></Panel>
        )}
      </section>

      {/* Créditos de carbono */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-600">Créditos de carbono</h2>
        {p.creditos?.length ? (
          <div className="mt-3 divide-y divide-trazo border-y border-trazo">
            {p.creditos.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-500">
                    {numero(c.tons_co2)} tCO₂e · añada {c.vintage_year}
                  </p>
                  <p className="text-xs text-tinta/70">
                    {REGISTROS[c.registry]}{c.registry_ref && ` · ${c.registry_ref}`}
                    {c.certified_on && ` · certificado ${fecha(c.certified_on)}`}
                  </p>
                </div>
                <Etiqueta color={c.status === 'certificado' ? 'var(--color-alga)' : undefined}>
                  {ESTADO_CREDITO[c.status]}
                </Etiqueta>
              </div>
            ))}
          </div>
        ) : (
          <Panel className="mt-3"><Vacio titulo="Sin créditos todavía"
            detalle="Cuando el proyecto tenga línea de base medida y hitos cumplidos, se puede iniciar la certificación." /></Panel>
        )}
      </section>
    </div>
  );
}
