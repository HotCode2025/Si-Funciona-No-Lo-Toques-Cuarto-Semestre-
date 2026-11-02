import { Link } from 'react-router-dom';
import { useReferencias, useTitulo } from '../lib/hooks.js';

export const ACTUALIZADO = '15 de octubre de 2026';
export const URL_DEFENSA_CONSUMIDOR = 'https://www.argentina.gob.ar/servicio/iniciar-un-reclamo-ante-defensa-del-consumidor';

/** Datos del titular del sitio (server/.env → OPERADOR_*). Solo se muestran los que están cargados. */
export function useOperador() {
  return useReferencias()?.operador || {};
}

function Titular() {
  const o = useOperador();
  const datos = [
    o.razon_social || o.razonSocial,
    o.cuit && `CUIT ${o.cuit}`,
    o.domicilio && `domicilio en ${o.domicilio}`,
  ].filter(Boolean);
  return (
    <p>
      El sitio <strong>AUTONEX</strong> (en adelante, "AUTONEX" o "la plataforma"){datos.length > 0 && <> es operado por {datos.join(', ')}</>}.
      {(o.email) && <> Email de contacto: <a href={`mailto:${o.email}`}>{o.email}</a>.</>}
    </p>
  );
}

/** Cómo contactar a AUTONEX: el email del titular si está cargado; si no, el pie del sitio. */
function Contacto() {
  const { email } = useOperador();
  return email ? <a href={`mailto:${email}`}>{email}</a> : <>el email de contacto que figura al pie del sitio</>;
}

function Indice({ secciones }) {
  return (
    <nav className="legal__indice" aria-label="Contenido">
      <strong>Contenido</strong>
      <ol>
        {secciones.map(([id, titulo]) => <li key={id}><a href={`#${id}`}>{titulo}</a></li>)}
      </ol>
    </nav>
  );
}

function Encabezado({ titulo, children }) {
  return (
    <>
      <h1 className="titulo-seccion">{titulo}</h1>
      <p className="texto-gris">Última actualización: {ACTUALIZADO}</p>
      {children}
    </>
  );
}

// ------------------------------------------------------------------------------------------- términos generales

const SECCIONES_TERMINOS = [
  ['titular', 'Titular y aceptación'],
  ['definiciones', 'Definiciones'],
  ['cuentas', 'Registro y cuentas'],
  ['funcionamiento', 'Cómo funciona AUTONEX'],
  ['publicaciones', 'Publicaciones, precios y compatibilidad'],
  ['compra', 'Compra y pago'],
  ['entregas', 'Entrega y seguimiento'],
  ['arrepentimiento', 'Derecho de arrepentimiento'],
  ['garantia', 'Garantía legal'],
  ['cancelaciones', 'Cancelaciones y reintegros'],
  ['usos', 'Obligaciones de los usuarios'],
  ['responsabilidad', 'Responsabilidad'],
  ['propiedad', 'Propiedad intelectual'],
  ['privacidad', 'Datos personales'],
  ['modificaciones', 'Modificaciones'],
  ['ley', 'Ley aplicable, reclamos y jurisdicción'],
];

export function Terminos() {
  useTitulo('Términos y condiciones');
  return (
    <div className="contenedor pagina legal">
      <Encabezado titulo="Términos y condiciones">
        <p>
          Estos términos regulan el uso de AUTONEX por parte de <strong>todas las personas usuarias</strong>: quienes navegan,
          quienes compran (con o sin cuenta) y quienes venden. Quienes abren un local además aceptan los
          {' '}<Link to="/terminos-vendedores">Términos y condiciones para vendedores</Link>.
        </p>
      </Encabezado>
      <Indice secciones={SECCIONES_TERMINOS} />

      <section id="titular">
        <h2>1. Titular y aceptación</h2>
        <Titular />
        <p>
          Al registrarte, publicar o comprar en AUTONEX aceptás estos términos y la <Link to="/privacidad">Política de
          privacidad</Link>. Si no estás de acuerdo, podés navegar el catálogo, pero no registrarte, publicar ni comprar.
          Ninguna cláusula de estos términos limita los derechos que la Ley 24.240 de Defensa del Consumidor y el Código Civil y
          Comercial de la Nación reconocen a quienes compran como consumidores.
        </p>
      </section>

      <section id="definiciones">
        <h2>2. Definiciones</h2>
        <ul>
          <li><strong>Usuario:</strong> toda persona que usa el sitio.</li>
          <li><strong>Comprador:</strong> el usuario que compra uno o más productos, con cuenta o sin cuenta.</li>
          <li><strong>Vendedor:</strong> la casa de repuestos, comercio o desarmadero que abre un local en AUTONEX y publica productos.</li>
          <li><strong>Publicación u oferta:</strong> un producto que un vendedor ofrece, con su precio, stock y condición (nuevo o usado).</li>
          <li><strong>Compra:</strong> el conjunto de productos que el comprador paga en una sola operación.</li>
          <li><strong>Pedido:</strong> la parte de una compra que corresponde a un vendedor. Una compra tiene un pedido por cada vendedor.</li>
        </ul>
      </section>

      <section id="cuentas">
        <h2>3. Registro y cuentas</h2>
        <ul>
          <li>Para registrarte tenés que ser mayor de 18 años y tener capacidad legal para contratar.</li>
          <li>Hay dos tipos de cuenta: <strong>comprador</strong> y <strong>vendedor</strong>. Para comprar no es obligatorio registrarse.</li>
          <li>Los datos que cargues tienen que ser verdaderos, completos y estar actualizados. AUTONEX puede pedir que los acredites.</li>
          <li>
            La cuenta es personal e intransferible. Tu contraseña es secreta: sos responsable de las operaciones hechas con tu
            cuenta. Si sospechás que otra persona la usa, avisá de inmediato a <Contacto />.
          </li>
          <li>AUTONEX puede suspender o dar de baja cuentas con datos falsos, que se usen para fraudes o que incumplan estos términos.</li>
          <li>
            Podés <strong>eliminar tu cuenta</strong> cuando quieras desde <Link to="/mi-cuenta">Mi cuenta</Link> → Eliminar mi cuenta, una vez
            entregados tus pedidos en curso. Se borran tus datos personales de la cuenta y las compras sin pagar se cancelan; las
            compras y los pedidos ya hechos se conservan con los datos de cada compra, como exige la ley.
          </li>
        </ul>
      </section>

      <section id="funcionamiento">
        <h2>4. Cómo funciona AUTONEX</h2>
        <p>
          AUTONEX es un <strong>marketplace</strong>: una plataforma donde vendedores de todo el país publican repuestos para
          autos, camionetas, vehículos pesados y motos, y donde los compradores los buscan, comparan y compran. Cada producto lo
          vende el vendedor que lo publica. AUTONEX ofrece el catálogo de vehículos y compatibilidades, el buscador, el carrito,
          el procesamiento del pago a través de Mercado Pago y las herramientas para seguir cada pedido.
        </p>
      </section>

      <section id="publicaciones">
        <h2>5. Publicaciones, precios y compatibilidad</h2>
        <ul>
          <li>
            Cada vendedor es responsable de la información de sus publicaciones: descripción, número de pieza, condición (nuevo o
            usado), precio y stock.
          </li>
          <li>Los precios se publican en <strong>pesos argentinos</strong> y son <strong>precios finales</strong>, con impuestos incluidos. El costo de envío se informa antes de pagar.</li>
          <li>
            Las compatibilidades entre repuestos y vehículos muestran su estado: <strong>verificada</strong> (confirmada con el
            catálogo del fabricante u otra fuente identificada) o <strong>sin verificar</strong>. Antes de comprar un repuesto sin
            verificar, chequeá el número de pieza con el que tenés o consultá al vendedor.
          </li>
          <li>Las imágenes identificadas como ilustrativas pueden no coincidir exactamente con el producto.</li>
          <li>Los datos de marcas, modelos y versiones de vehículos provienen del registro automotor (DNRPA) y de otras fuentes públicas.</li>
        </ul>
      </section>

      <section id="compra">
        <h2>6. Compra y pago</h2>
        <ul>
          <li>
            El comprador arma el carrito, elige para cada pedido el retiro en el local o el envío a domicilio y confirma la compra.
            Antes de pagar ve el detalle de los productos, los costos de envío y el total.
          </li>
          <li>Al confirmar, AUTONEX recalcula precios, stock y envíos con los datos vigentes. Si algo cambió, lo informa antes del pago.</li>
          <li>
            El pago se hace a través de <strong>Mercado Pago</strong>, con los medios que ofrece en cada momento (tarjetas de crédito
            y débito, dinero en cuenta y otros). Los datos de la tarjeta se ingresan en Mercado Pago: AUTONEX no los recibe ni los guarda.
          </li>
          <li>
            La compra se perfecciona cuando Mercado Pago <strong>aprueba el pago</strong>. En ese momento se descuenta el stock,
            cada vendedor recibe su pedido y el comprador puede descargar el comprobante de la compra. Si el pago se rechaza, no se
            cobra nada y la compra queda guardada para volver a intentarlo.
          </li>
          <li>Cada vendedor emite al comprador la factura que corresponde por su pedido.</li>
        </ul>
      </section>

      <section id="entregas">
        <h2>7. Entrega y seguimiento</h2>
        <ul>
          <li><strong>Retiro en el local:</strong> sin cargo, en la dirección y el horario del vendedor, cuando el pedido figura como "Listo para retirar".</li>
          <li>
            <strong>Envío a domicilio:</strong> con el transportista elegido (Andreani, OCA, Correo Argentino o moto en la misma
            ciudad), al costo informado antes de pagar. Los plazos son estimados y dependen del transportista.
          </li>
          <li>
            El estado de cada pedido (pagado, en preparación, enviado o listo para retirar, entregado) y el número de seguimiento
            del envío se ven en "Mis compras", en "Seguí tu compra" y en el comprobante.
          </li>
          <li>Al recibir el pedido, revisá que el producto sea el comprado y que esté en buen estado.</li>
        </ul>
      </section>

      <section id="arrepentimiento">
        <h2>8. Derecho de arrepentimiento</h2>
        <p>
          Por tratarse de una venta a distancia, el comprador puede <strong>revocar la compra dentro de los 10 días corridos</strong>
          {' '}contados desde la entrega del producto o desde la compra, lo último que ocurra, sin necesidad de explicar el motivo y
          sin costo (artículo 34 de la Ley 24.240 y artículos 1110 a 1116 del Código Civil y Comercial). Este derecho no se puede renunciar.
        </p>
        <ul>
          <li>
            Para ejercerlo, usá el <Link to="/arrepentimiento"><strong>Botón de arrepentimiento</strong></Link> (al pie de todas las
            páginas) con el número de compra y tu email. En el momento recibís el <strong>código de identificación</strong> de tu
            pedido de revocación (Resolución 424/2020 de la Secretaría de Comercio Interior).
          </li>
          <li>Desde ese momento tus pedidos quedan frenados: el vendedor no los prepara ni los despacha.</li>
          <li>Si todavía no recibiste el producto, el vendedor cancela el pedido y se te reintegra el total.</li>
          <li>
            Si ya lo recibiste, el vendedor coordina con vos la devolución, con los gastos a su cargo. Devolvé el producto en el
            estado en que lo recibiste, con sus accesorios y embalaje si los tenía. Cuando lo recibe, cancela el pedido y se te
            reintegra el total.
          </li>
          <li>
            El reintegro es por el total del pedido (productos y envío) y lo hace AUTONEX con Mercado Pago, al mismo medio con el
            que pagaste. Te avisamos por mail y lo ves en el detalle de tu compra.
          </li>
        </ul>
      </section>

      <section id="garantia">
        <h2>9. Garantía legal</h2>
        <p>
          Los productos tienen la garantía legal del artículo 11 de la Ley 24.240 por defectos o vicios: <strong>6 meses para
          productos nuevos</strong> y <strong>3 meses para productos usados</strong>, contados desde la entrega. Para hacerla valer,
          comunicate con el vendedor del pedido; sus datos están en tu compra, en el comprobante y en su página. Las garantías del
          fabricante, cuando existen, se suman a la garantía legal.
        </p>
      </section>

      <section id="cancelaciones">
        <h2>10. Cancelaciones y reintegros</h2>
        <ul>
          <li>Una compra que no se pagó no genera ninguna obligación: si no la vas a pagar, no tenés que hacer nada.</li>
          <li>
            Si después del pago un vendedor no puede entregar un producto (por ejemplo, por falta de stock), debe avisar al comprador
            y se le reintegra el total de ese pedido por el mismo medio de pago.
          </li>
          <li>Los reintegros por arrepentimiento, garantía o cancelación se hacen a través de Mercado Pago, en los plazos de cada medio de pago.</li>
        </ul>
      </section>

      <section id="usos">
        <h2>11. Obligaciones de los usuarios</h2>
        <p>No está permitido:</p>
        <ul>
          <li>cargar datos falsos o de otra persona;</li>
          <li>usar el sitio para fraudes, compras con medios de pago ajenos o actividades ilegales;</li>
          <li>publicar productos de origen ilícito, falsificados o cuya venta esté prohibida;</li>
          <li>intentar acceder a cuentas, datos o funciones que no te corresponden, o afectar el funcionamiento del sitio;</li>
          <li>copiar el catálogo o la información del sitio de forma automatizada.</li>
        </ul>
      </section>

      <section id="responsabilidad">
        <h2>12. Responsabilidad</h2>
        <p>
          Cada vendedor responde por los productos que vende, por la información de sus publicaciones y por el cumplimiento de sus
          pedidos. AUTONEX trabaja para que el catálogo sea correcto, identifica qué datos están verificados, procesa los pagos y
          colabora en la resolución de los reclamos entre compradores y vendedores. La responsabilidad de AUTONEX frente a los
          consumidores es la que establece la Ley 24.240. AUTONEX no responde por interrupciones del sitio por causas ajenas a su
          control, como fallas de proveedores de internet o de los medios de pago.
        </p>
      </section>

      <section id="propiedad">
        <h2>13. Propiedad intelectual</h2>
        <p>
          La marca, el diseño, el software y los contenidos propios de AUTONEX están protegidos por la Ley 11.723 de Propiedad
          Intelectual y la Ley 22.362 de Marcas y Designaciones. Las marcas y logos de vehículos y de repuestos pertenecen a sus
          titulares y se usan solo para identificar productos. Las fotos y logos de terceros se usan según sus licencias, con
          autor y licencia en la página de <Link to="/creditos">Créditos</Link>.
        </p>
      </section>

      <section id="privacidad">
        <h2>14. Datos personales</h2>
        <p>
          El tratamiento de los datos personales se rige por la Ley 25.326 y la <Link to="/privacidad">Política de privacidad</Link>,
          que forma parte de estos términos.
        </p>
      </section>

      <section id="modificaciones">
        <h2>15. Modificaciones</h2>
        <p>
          AUTONEX puede modificar estos términos. Los cambios se publican en esta página con su fecha de actualización y rigen desde
          su publicación. Las compras realizadas antes de un cambio se rigen por los términos vigentes al momento de la compra.
        </p>
      </section>

      <section id="ley">
        <h2>16. Ley aplicable, reclamos y jurisdicción</h2>
        <p>
          Estos términos se rigen por las leyes de la República Argentina. Ante cualquier problema, escribinos a <Contacto /> o
          contactá al vendedor del pedido. También podés hacer tu reclamo ante Defensa del Consumidor:
          {' '}<a href={URL_DEFENSA_CONSUMIDOR} target="_blank" rel="noopener noreferrer">Defensa de las y los Consumidores. Para reclamos ingrese aquí</a>.
          En las relaciones de consumo son competentes los tribunales que corresponden según la Ley 24.240, incluidos los del domicilio del consumidor.
        </p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------------------------------- términos para vendedores

const SECCIONES_VENDEDORES = [
  ['alcance', 'Alcance'],
  ['alta', 'Alta del local'],
  ['publicar', 'Publicaciones'],
  ['prohibidos', 'Productos prohibidos'],
  ['pedidos', 'Gestión de pedidos'],
  ['facturacion', 'Facturación'],
  ['comision', 'Comisión y liquidación'],
  ['consumidores', 'Obligaciones con los compradores'],
  ['datos-compradores', 'Datos de los compradores'],
  ['sanciones', 'Suspensión y baja'],
  ['responsabilidad-vendedor', 'Responsabilidad'],
  ['cambios-vendedores', 'Modificaciones'],
];

export function TerminosVendedores() {
  useTitulo('Términos para vendedores');
  return (
    <div className="contenedor pagina legal">
      <Encabezado titulo="Términos y condiciones para vendedores">
        <p>
          Estos términos se suman a los <Link to="/terminos">Términos y condiciones generales</Link> y se aplican a quienes abren
          un local en AUTONEX. Se aceptan al crear una cuenta de vendedor.
        </p>
      </Encabezado>
      <Indice secciones={SECCIONES_VENDEDORES} />

      <section id="alcance">
        <h2>1. Alcance</h2>
        <p>
          El vendedor usa AUTONEX para ofrecer y vender repuestos a compradores de todo el país. Vende en nombre propio: es el
          proveedor de los productos frente al comprador, en los términos de la Ley 24.240.
        </p>
      </section>

      <section id="alta">
        <h2>2. Alta del local</h2>
        <ul>
          <li>El vendedor carga datos reales del local: nombre comercial, dirección, ciudad, provincia, teléfono y horario de atención.</li>
          <li>
            Debe estar inscripto ante la Agencia de Recaudación y Control Aduanero (ARCA) y contar con las habilitaciones que exija su
            actividad en su jurisdicción. AUTONEX puede pedirle que acredite su CUIT y su condición fiscal.
          </li>
          <li>
            Los desarmaderos y comercios de autopartes usadas deben estar inscriptos en el Registro Único de Desarmaderos de
            Automotores y Actividades Conexas (RUDAC) y cumplir la Ley 25.761, que exige la identificación de las autopartes recuperadas.
          </li>
          <li>El vendedor mantiene los datos del local actualizados desde "Mi local". Se muestran en su página pública y en los retiros en el local.</li>
        </ul>
      </section>

      <section id="publicar">
        <h2>3. Publicaciones</h2>
        <ul>
          <li>Publicar es gratuito. El vendedor publica productos del catálogo de AUTONEX o carga productos nuevos.</li>
          <li>
            Cada publicación indica el <strong>precio final en pesos</strong> (con impuestos incluidos), el <strong>stock real</strong>
            y la <strong>condición</strong> del producto (nuevo o usado). Un mismo producto se puede publicar una vez como nuevo y otra
            como usado.
          </li>
          <li>
            El vendedor informa el número de pieza del fabricante y las compatibilidades con datos correctos. Los productos y
            compatibilidades que carga quedan como <strong>sin verificar</strong> hasta que AUTONEX los revise.
          </li>
          <li>Las publicaciones sin stock o pausadas no se pueden comprar. El vendedor actualiza el stock cuando vende por otros canales.</li>
          <li>AUTONEX puede corregir datos del catálogo, pausar publicaciones con información incorrecta y verificar o quitar compatibilidades.</li>
        </ul>
      </section>

      <section id="prohibidos">
        <h2>4. Productos prohibidos</h2>
        <p>No se pueden publicar:</p>
        <ul>
          <li>autopartes de origen ilícito o que no se puedan identificar cuando la ley lo exige;</li>
          <li>productos falsificados, o réplicas presentadas como originales;</li>
          <li>productos cuya venta esté prohibida o retirados del mercado por razones de seguridad;</li>
          <li>productos que no sean repuestos, accesorios o insumos para vehículos.</li>
        </ul>
      </section>

      <section id="pedidos">
        <h2>5. Gestión de pedidos</h2>
        <ul>
          <li>El vendedor recibe el pedido en su panel cuando Mercado Pago aprueba el pago, con los datos del comprador y de la entrega.</li>
          <li>Debe marcarlo <strong>"En preparación"</strong> dentro de 1 día hábil desde el pago.</li>
          <li>
            Debe despacharlo o dejarlo <strong>"Listo para retirar"</strong> dentro de los 3 días hábiles desde el pago. En los envíos
            por transportista carga el <strong>número de seguimiento</strong> al marcarlo como enviado.
          </li>
          <li>Marca el pedido como <strong>"Entregado"</strong> cuando el comprador lo recibe o lo retira.</li>
          <li>
            Si no puede cumplir un pedido, avisa al comprador de inmediato. El comprador recibe el reintegro total de ese pedido y
            AUTONEX puede aplicar las medidas del punto 10.
          </li>
        </ul>
      </section>

      <section id="facturacion">
        <h2>6. Facturación</h2>
        <p>
          El vendedor emite la factura electrónica que corresponda al comprador por cada pedido, según la normativa de ARCA. Los
          datos del comprador necesarios para facturar están en el pedido.
        </p>
      </section>

      <section id="comision">
        <h2>7. Comisión y liquidación</h2>
        <ul>
          <li>
            AUTONEX cobra una <strong>comisión del 8 % más IVA</strong> sobre el precio de los productos de cada pedido pagado. La
            comisión no se aplica sobre el costo del envío.
          </li>
          <li>
            Los pagos de los compradores se cobran a través de Mercado Pago. AUTONEX liquida al vendedor el importe de cada pedido,
            neto de la comisión, dentro de los 10 días hábiles posteriores a que el pedido figure como entregado.
          </li>
          <li>
            Si hay un pedido de arrepentimiento, un reclamo de garantía o una cancelación pendiente, el importe de ese pedido se
            retiene hasta que se resuelva. Si el pedido se reintegra al comprador, no se cobra comisión.
          </li>
          <li>AUTONEX informa con al menos 30 días de anticipación cualquier cambio en la comisión.</li>
        </ul>
      </section>

      <section id="consumidores">
        <h2>8. Obligaciones con los compradores</h2>
        <ul>
          <li>Responder las consultas de los compradores en un plazo razonable, por los datos de contacto del local.</li>
          <li>
            Respetar el <strong>derecho de arrepentimiento</strong>: cuando un comprador pide revocar una compra con el Botón de
            arrepentimiento, el pedido muestra el código de identificación y queda frenado: no se puede preparar ni despachar.
            El vendedor lo cancela desde su panel —si el comprador ya tiene el producto, cuando se lo devuelve, con los gastos
            de devolución a su cargo— y AUTONEX le reintegra al comprador el total del pedido con Mercado Pago (artículo 34 de
            la Ley 24.240).
          </li>
          <li>Cumplir la <strong>garantía legal</strong>: 6 meses para productos nuevos y 3 meses para usados, desde la entrega (artículo 11 de la Ley 24.240).</li>
          <li>Tratar a los compradores en condiciones de trato digno y equitativo.</li>
        </ul>
      </section>

      <section id="datos-compradores">
        <h2>9. Datos de los compradores</h2>
        <p>
          El vendedor usa los datos de los compradores (nombre, DNI, teléfono, email y dirección de envío) <strong>solo para
          facturar, preparar y entregar el pedido</strong> y para atender garantías y arrepentimientos. No puede usarlos para
          publicidad ni cederlos a terceros. Los protege según la Ley 25.326 de Protección de los Datos Personales.
        </p>
      </section>

      <section id="sanciones">
        <h2>10. Suspensión y baja</h2>
        <ul>
          <li>
            Ante incumplimientos (datos falsos, productos prohibidos, pedidos no cumplidos, reclamos reiterados), AUTONEX puede pausar
            publicaciones, suspender el local o darlo de baja, con aviso al vendedor.
          </li>
          <li>
            El vendedor puede dar de baja su local cuando quiera eliminando su cuenta desde Mi cuenta, una vez entregados los pedidos
            en curso: sus publicaciones se pausan y el local deja de mostrarse. Las garantías y los arrepentimientos de ventas ya
            hechas los sigue atendiendo según la ley.
          </li>
        </ul>
      </section>

      <section id="responsabilidad-vendedor">
        <h2>11. Responsabilidad</h2>
        <p>
          El vendedor responde frente a los compradores y a las autoridades por los productos que vende, por la información que
          publica y por el cumplimiento de sus obligaciones legales, fiscales y de defensa del consumidor. Mantiene indemne a
          AUTONEX frente a reclamos que se originen en sus incumplimientos.
        </p>
      </section>

      <section id="cambios-vendedores">
        <h2>12. Modificaciones</h2>
        <p>
          AUTONEX puede modificar estos términos. Los cambios se informan a los vendedores con al menos 15 días de anticipación,
          salvo los que exija una norma. Si el vendedor no está de acuerdo, puede dar de baja su local antes de que rijan.
        </p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------------------------------- privacidad

const SECCIONES_PRIVACIDAD = [
  ['responsable', 'Responsable de los datos'],
  ['que-datos', 'Qué datos recolectamos'],
  ['para-que', 'Para qué los usamos'],
  ['compartir', 'Con quién los compartimos'],
  ['navegador', 'Qué se guarda en tu navegador'],
  ['seguridad', 'Seguridad'],
  ['conservacion', 'Conservación'],
  ['derechos', 'Tus derechos'],
  ['menores', 'Menores de edad'],
  ['cambios-privacidad', 'Cambios en esta política'],
];

export function Privacidad() {
  useTitulo('Política de privacidad');
  return (
    <div className="contenedor pagina legal">
      <Encabezado titulo="Política de privacidad">
        <p>Cómo AUTONEX recolecta, usa y protege tus datos personales, según la Ley 25.326 de Protección de los Datos Personales.</p>
      </Encabezado>
      <Indice secciones={SECCIONES_PRIVACIDAD} />

      <section id="responsable">
        <h2>1. Responsable de los datos</h2>
        <Titular />
        <p>El titular de AUTONEX es el responsable de la base de datos de usuarios y compras del sitio.</p>
      </section>

      <section id="que-datos">
        <h2>2. Qué datos recolectamos</h2>
        <ul>
          <li><strong>Cuenta:</strong> nombre, apellido, email y contraseña (guardada encriptada); teléfono, DNI y foto de perfil si los cargás.
            La foto de perfil es opcional, solo se ve en tu cuenta y se guarda con un link privado.</li>
          <li><strong>Compras:</strong> nombre, apellido, email, teléfono, DNI y, si elegís envío, la dirección de entrega; los productos, las entregas y el estado del pago.</li>
          <li><strong>Vendedores:</strong> los datos del local (nombre comercial, logo, dirección, ciudad, provincia, teléfono, WhatsApp, horario y descripción), que se publican en su página.</li>
          <li><strong>Arrepentimientos:</strong> el número de compra, el email y el motivo, si lo indicás.</li>
          <li><strong>Datos técnicos:</strong> registros del servidor (dirección IP, fecha y página solicitada) con fines de seguridad.</li>
        </ul>
        <p>AUTONEX <strong>no recibe ni guarda datos de tarjetas</strong>: se ingresan directamente en Mercado Pago.</p>
      </section>

      <section id="para-que">
        <h2>3. Para qué los usamos</h2>
        <ul>
          <li>Crear y administrar tu cuenta y confirmar que el email es tuyo.</li>
          <li>Procesar compras y pagos, y coordinar la entrega de cada pedido.</li>
          <li>Permitirte seguir tus compras y descargar el comprobante.</li>
          <li>Enviarte mails sobre tu cuenta y tus compras: confirmación del email, comprobante de cada compra y recuperación de la contraseña. No te mandamos publicidad.</li>
          <li>Gestionar arrepentimientos, garantías, reclamos y consultas.</li>
          <li>Prevenir fraudes y proteger la seguridad del sitio.</li>
          <li>Cumplir obligaciones legales y fiscales.</li>
        </ul>
        <p>No vendemos tus datos ni los usamos para publicidad de terceros.</p>
      </section>

      <section id="compartir">
        <h2>4. Con quién los compartimos</h2>
        <ul>
          <li>
            <strong>Con el vendedor de cada pedido:</strong> nombre, DNI, teléfono, email y, si elegiste envío, la dirección. Los
            necesita para facturar, preparar y entregar. Cada vendedor ve solo los datos de sus pedidos.
          </li>
          <li><strong>Con Mercado Pago:</strong> el detalle y el importe de la compra y tu nombre, para procesar el pago, según sus propias políticas.</li>
          <li><strong>Con los transportistas,</strong> a través del vendedor: los datos necesarios para el envío.</li>
          <li><strong>Con el proveedor de correo</strong> que usamos para enviar los mails (Gmail, de Google, o Resend): tu email y el contenido del mensaje, solo para entregarlo.</li>
          <li><strong>Con autoridades</strong> judiciales o administrativas, cuando la ley lo exija.</li>
        </ul>
      </section>

      <section id="navegador">
        <h2>5. Qué se guarda en tu navegador</h2>
        <ul>
          <li><strong>Sesión:</strong> si iniciás sesión, un identificador para mantenerla abierta hasta que la cierres.</li>
          <li><strong>Carrito y vehículo elegido:</strong> para que no los pierdas al volver al sitio.</li>
          <li><strong>Compras sin cuenta:</strong> el código de acceso a la compra se guarda solo en la pestaña donde compraste y se borra al cerrarla.</li>
        </ul>
        <p>AUTONEX no usa cookies de publicidad ni de seguimiento de terceros.</p>
      </section>

      <section id="seguridad">
        <h2>6. Seguridad</h2>
        <p>
          El sitio funciona con conexión cifrada (HTTPS), las contraseñas se guardan encriptadas y cada usuario accede solo a sus
          propios datos. Aplicamos medidas técnicas y organizativas para proteger la información contra accesos no autorizados,
          pérdida o alteración.
        </p>
      </section>

      <section id="conservacion">
        <h2>7. Conservación</h2>
        <p>
          Conservamos los datos de la cuenta mientras esté activa, y los de las compras durante el tiempo necesario para las
          entregas, las garantías y los reclamos, y el que exijan las normas fiscales y de defensa del consumidor.
        </p>
        <p>La foto de perfil se borra en el momento en que la quitás o eliminás tu cuenta.</p>
      </section>

      <section id="derechos">
        <h2>8. Tus derechos</h2>
        <ul>
          <li>
            <strong>Acceso:</strong> podés pedir saber qué datos tuyos tenemos, en forma gratuita a intervalos no inferiores a seis
            meses, salvo que acredites un interés legítimo (artículo 14 de la Ley 25.326). Respondemos dentro de los 10 días corridos.
          </li>
          <li>
            <strong>Rectificación, actualización y supresión:</strong> podés pedir que corrijamos, actualicemos o eliminemos tus
            datos. Lo hacemos dentro de los 5 días hábiles (artículo 16 de la Ley 25.326), salvo los que debamos conservar por ley.
          </li>
          <li>
            <strong>Eliminar tu cuenta:</strong> lo hacés vos desde <Link to="/mi-cuenta">Mi cuenta</Link> → Eliminar mi cuenta. Se borran
            tus datos personales de la cuenta; los de las compras se conservan el tiempo que exige la ley.
          </li>
          <li>Para ejercer los demás derechos, escribí a <Contacto /> desde el email asociado a tu cuenta o a tu compra.</li>
        </ul>
        <p className="legal__aaip">
          La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la
          atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
          incumplimiento de las normas vigentes en materia de protección de datos personales.
        </p>
      </section>

      <section id="menores">
        <h2>9. Menores de edad</h2>
        <p>AUTONEX no está dirigido a menores de 18 años, que no pueden registrarse ni comprar sin la intervención de sus representantes legales.</p>
      </section>

      <section id="cambios-privacidad">
        <h2>10. Cambios en esta política</h2>
        <p>
          Si esta política cambia, publicamos la nueva versión en esta página con su fecha de actualización. Ver también los
          {' '}<Link to="/terminos">Términos y condiciones</Link>.
        </p>
      </section>
    </div>
  );
}
