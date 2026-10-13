# Estado de coherencia del proyecto

## Tabla de tokens

El sitio, la demo en el navegador, la API real, la semilla SQL y los documentos
fundacionales usan la misma tabla: 15 / 25 / 50 / 10 / 100 OKN.

| Accion | OKN |
|---|---:|
| Reporte basico | +15 |
| Foto verificada | +25 |
| Racha semanal | +50 |
| Verificacion comunitaria | +10 |
| Primera zona nueva | +100 |

## Equipo mostrado en la demo

Los autores de ejemplos en el sitio son Lautaro Martinez, Leandro Orozco, Gabriel
Maculus, Jose Rodriguez y Otar. La cuenta con la que se prueba la plataforma se
llama OceanOS, para que el recorrido no dependa de una persona del grupo.

## Diferencias que corresponden a una etapa posterior

El MVP web demuestra el flujo principal sin pedir registro: mapa, reportes,
verificacion comunitaria, tokens, canjes, panel de organizaciones y mercado.
Quedan para produccion la subida de fotos, la clasificacion IA en el dispositivo,
notificaciones, integracion real de n8n/Supabase, cobros y una app movil nativa.

El mapa usa Leaflet con OpenStreetMap en vez de Mapbox. Es una eleccion adecuada
para la demo gratuita porque no requiere una tarjeta ni una clave.
