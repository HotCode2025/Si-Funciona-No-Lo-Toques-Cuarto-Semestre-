# Economia de tokens OKN

La plataforma implementa la misma tabla de recompensas que los materiales del
MVP. Asi, la explicacion del producto, el recorrido de demostracion y la logica
del sitio muestran siempre los mismos valores.

| Accion | Tokens OKN | Condicion |
|---|---:|---|
| Reporte basico | +15 | Ubicacion y tipo confirmados |
| Foto verificada por IA o comunidad | +25 | Especie identificada con al menos 80% de confianza o aprobacion comunitaria |
| Racha semanal | +50 | Al menos un reporte por dia durante 7 dias |
| Verificacion de otro usuario | +10 | Voto en un reporte de baja confianza |
| Primer reporte de zona nueva | +100 | Area sin reportes en los ultimos 30 dias |

Se mantienen el umbral del 80% de confianza, los 3 votos ponderados por
reputacion, los 30 dias que definen una zona nueva y los 7 dias de racha.
La reputacion suma 5 puntos cuando un reporte se verifica, pierde 10 si se
rechaza y tiene un maximo de 1000 puntos.

## Donde vive el numero

La interfaz no escribe estos montos a mano. La demo los obtiene de
`frontend/src/services/demo/servidor.js` y la API real de
`backend/src/services/sightings.service.js`, a traves de `GET /tokens/reglas`.
De esta forma, reporte, billetera, verificacion y la guia de tokens quedan
sincronizados.
