import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { api } from '../../services/api.js';
import {
  Panel, Barra, Boton, Campo, Entrada, Cargando, CajaError, Etiqueta, Sonda,
} from '../../components/ui/index.jsx';
import { numero, dolares, fecha, colorSalud, TIPO_ACTIVO } from '../../utils/format.js';

export default function ActivoDetalle() {
  const { id } = useParams();
  const { data, error, loading, recargar } = useFetch(`/mercado/${id}`, [id]);
  const [form, setForm] = useState({ buyerName: '', buyerEmail: '', units: '' });
  const [enviando, setEnviando] = useState(false);
  const [falla, setFalla] = useState(null);
  const [orden, setOrden] = useState(null);

  if (loading) return <div className="mx-auto max-w-4xl px-5 py-10"><Cargando /></div>;
  if (error)   return <div className="mx-auto max-w-4xl px-5 py-10"><CajaError error={error} onReintentar={recargar} /></div>;

  const a = data.activo;
  const unidades = Number(form.units) || 0;
  const bruto = unidades * Number(a.unit_price_usd);
  const vendidoPct = (Number(a.units_sold) / Number(a.units_total)) * 100;

  const comprar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setFalla(null);
    try {
      const r = await api.post(`/mercado/${id}/ordenes`, {
        buyerName: form.buyerName,
        buyerEmail: form.buyerEmail,
        units: Number(form.units),
      });
      setOrden(r.orden);
      recargar();
    } catch (e) {
      setFalla(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 lg:px-10">
      <Link to="/mercado" className="inline-flex items-center gap-1.5 text-sm text-tinta hover:text-kelp">
        <ArrowLeft size={14} /> Todos los activos
      </Link>

      <div className="mt-4 flex flex-wrap gap-2">
        <Etiqueta color="var(--color-kelp)">{TIPO_ACTIVO[a.asset_kind]}</Etiqueta>
        {a.registry && a.registry !== 'interno' && (
          <Etiqueta>{a.registry === 'verra' ? 'Verra' : 'Gold Standard'} · {a.registry_ref}</Etiqueta>
        )}
        {a.vintage_year && <Etiqueta>Añada {a.vintage_year}</Etiqueta>}
      </div>

      <h1 className="mt-3 font-display text-3xl leading-tight font-600">{a.title}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-tinta">{a.summary}</p>

      <div className="mt-8 grid gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <Panel className="p-5">
            <h2 className="font-display text-lg font-600">De dónde sale</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ['Proyecto', a.project_name],
                ['Organización', `${a.org_name}`],
                ['Zona', a.zone_name],
                ['Superficie del proyecto', `${numero(a.hectares, 1)} ha`],
                a.certified_on && ['Certificado', fecha(a.certified_on)],
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-trazo pb-3 last:border-0">
                  <dt className="text-tinta/70">{k}</dt>
                  <dd className="text-right font-500">{v}</dd>
                </div>
              ))}
            </dl>

            {a.salud_zona && (
              <div className="mt-5 border-t border-trazo pt-5">
                <p className="text-sm text-tinta/70">Salud actual de {a.zone_name}</p>
                <div className="mt-2 flex items-center gap-4">
                  <span className="cifra font-display text-2xl font-600"
                        style={{ color: colorSalud(a.salud_zona.health_index) }}>
                    {numero(a.salud_zona.health_index, 1)}
                  </span>
                  <div className="flex-1">
                    <Barra valor={a.salud_zona.health_index} color={colorSalud(a.salud_zona.health_index)} />
                    <p className="mt-1.5 text-xs text-tinta/70">
                      cachiyuyo {numero(a.salud_zona.kelp_cobertura_pct, 1)}% ·
                      {' '}{a.salud_zona.avistamientos_tiburon} tiburones en 90 días
                    </p>
                  </div>
                </div>
                <Link to={`/ecosistema/${a.zone_slug}`}
                      className="mt-3 inline-block text-sm underline underline-offset-4 hover:text-kelp">
                  Ver los datos de la zona
                </Link>
              </div>
            )}
          </Panel>
        </div>

        {/* Compra */}
        <div>
          <Panel className="p-5">
            <div className="flex items-baseline justify-between">
              <span className="cifra font-display text-2xl font-600">{dolares(a.unit_price_usd)}</span>
              <span className="text-sm text-tinta/70">por {a.unit_label}</span>
            </div>
            <div className="mt-4">
              <Barra valor={vendidoPct} alto={4} />
              <p className="mt-1.5 text-xs text-tinta/70">
                {numero(a.units_available, 1)} de {numero(a.units_total, 1)} {a.unit_label} disponibles
              </p>
            </div>

            {orden ? (
              <div className="mt-5 rounded-carta border border-alga/40 bg-alga/5 p-4">
                <p className="inline-flex items-center gap-2 font-500 text-alga">
                  <Check size={16} /> Reserva registrada
                </p>
                <p className="mt-2 text-sm text-tinta">
                  {numero(orden.units, 1)} {a.unit_label} por {dolares(orden.gross_usd)}.
                  Te escribimos a {orden.buyer_email} para cerrar el pago y transferir el activo.
                </p>
              </div>
            ) : (
              <form onSubmit={comprar} className="mt-5 space-y-3">
                <Campo etiqueta="Cantidad" requerido
                       ayuda={`Hasta ${numero(a.units_available, 1)} ${a.unit_label}`}>
                  <Entrada type="number" step="0.001" min="0.001" max={a.units_available} required
                           value={form.units}
                           onChange={(e) => setForm({ ...form, units: e.target.value })} />
                </Campo>
                <Campo etiqueta="Empresa o nombre" requerido>
                  <Entrada required value={form.buyerName}
                           onChange={(e) => setForm({ ...form, buyerName: e.target.value })} />
                </Campo>
                <Campo etiqueta="Correo" requerido>
                  <Entrada type="email" required value={form.buyerEmail}
                           onChange={(e) => setForm({ ...form, buyerEmail: e.target.value })} />
                </Campo>

                {unidades > 0 && (
                  <div className="rounded-carta bg-abismo px-3 py-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-tinta/70">Total</span>
                      <span className="cifra font-500">{dolares(bruto)}</span>
                    </div>
                    <p className="mt-1 text-xs text-tinta/70">
                      {a.commission_pct}% de comisión vuelve al fondo de restauración
                    </p>
                  </div>
                )}

                {falla && <CajaError error={falla} />}
                <Boton type="submit" variante="kelp" className="w-full" cargando={enviando}>
                  Reservar
                </Boton>
                <p className="text-xs text-tinta/70">
                  Reservar no cobra nada. Un asesor confirma la operación antes del pago.
                </p>
              </form>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
