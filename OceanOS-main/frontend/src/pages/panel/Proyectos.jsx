import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { useOrg } from '../../hooks/useOrg.js';
import { api } from '../../services/api.js';
import {
  Panel, Barra, Boton, Campo, Entrada, Area, Selector, Cargando, CajaError, Etiqueta, Vacio,
} from '../../components/ui/index.jsx';
import { numero, ESTADO_PROYECTO } from '../../utils/format.js';

export default function Proyectos() {
  const org = useOrg();
  const { data, error, loading, recargar } = useFetch(
    org ? `/organizaciones/${org.id}/proyectos` : null, [org?.id],
  );
  const { data: zonas } = useFetch('/ecosistema/zonas');

  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ name: '', zoneSlug: '', description: '', targetHectares: '' });
  const [enviando, setEnviando] = useState(false);
  const [falla, setFalla] = useState(null);

  const crear = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setFalla(null);
    try {
      await api.post(`/organizaciones/${org.id}/proyectos`, {
        name: form.name,
        zoneSlug: form.zoneSlug,
        description: form.description || undefined,
        targetHectares: form.targetHectares ? Number(form.targetHectares) : undefined,
      });
      setForm({ name: '', zoneSlug: '', description: '', targetHectares: '' });
      setAbierto(false);
      recargar();
    } catch (e) {
      setFalla(e);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-4xl px-5 py-6"><Cargando /></div>;

  const proyectos = data?.proyectos ?? [];

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-600">Proyectos</h1>
          <p className="mt-1 text-sm text-tinta/80">
            {proyectos.length} {proyectos.length === 1 ? 'proyecto' : 'proyectos'} · {org.name}
          </p>
        </div>
        <Boton variante={abierto ? 'linea' : 'kelp'} onClick={() => setAbierto(!abierto)}>
          {abierto ? 'Cancelar' : <><Plus size={15} /> Nuevo proyecto</>}
        </Boton>
      </div>

      {error && <div className="mt-4"><CajaError error={error} onReintentar={recargar} /></div>}

      {abierto && (
        <Panel className="mt-5 p-5">
          <h2 className="font-display text-lg font-600">Nuevo proyecto</h2>
          <form onSubmit={crear} className="mt-4 space-y-4">
            <Campo etiqueta="Nombre" requerido>
              <Entrada required minLength={2} value={form.name}
                       onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Zona" requerido>
                <Selector required value={form.zoneSlug}
                          onChange={(e) => setForm({ ...form, zoneSlug: e.target.value })}>
                  <option value="">Elegí una zona</option>
                  {(zonas?.zonas ?? []).map((z) => (
                    <option key={z.slug} value={z.slug}>{z.name}</option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Objetivo" ayuda="Hectáreas a restaurar">
                <Entrada type="number" step="0.1" min="0" value={form.targetHectares}
                         onChange={(e) => setForm({ ...form, targetHectares: e.target.value })} />
              </Campo>
            </div>
            <Campo etiqueta="Descripción">
              <Area value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Campo>
            {falla && <CajaError error={falla} />}
            <Boton type="submit" variante="kelp" cargando={enviando}>Crear proyecto</Boton>
          </form>
        </Panel>
      )}

      {proyectos.length === 0 && !abierto ? (
        <Panel className="mt-6">
          <Vacio titulo="Todavía no hay proyectos"
                 detalle="Un proyecto agrupa las hectáreas que restaurás en una zona, sus hitos y el carbono que generan."
                 accion={<Boton variante="kelp" onClick={() => setAbierto(true)}>Crear el primero</Boton>} />
        </Panel>
      ) : (
        <div className="mt-6 space-y-3">
          {proyectos.map((p) => (
            <Link key={p.project_id} to={`/panel/proyectos/${p.project_id}`}>
              <Panel className="p-5 transition-colors hover:border-kelp">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-600">{p.name}</h2>
                    <p className="text-sm text-tinta/70">{p.zone_name}</p>
                  </div>
                  <Etiqueta>{ESTADO_PROYECTO[p.status]}</Etiqueta>
                </div>

                {p.target_hectares > 0 && (
                  <div className="mt-4">
                    <Barra valor={p.avance_pct ?? 0} />
                    <p className="mt-1.5 text-xs text-tinta/70">
                      {numero(p.hectares, 1)} de {numero(p.target_hectares, 1)} ha
                      {' · '}{p.hitos_cumplidos}/{p.hitos} hitos
                      {p.tco2_certificado > 0 && ` · ${numero(p.tco2_certificado)} tCO₂e certificadas`}
                    </p>
                  </div>
                )}
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
