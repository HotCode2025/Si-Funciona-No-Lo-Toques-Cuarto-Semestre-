# OceanOS IA

Servicio que mira las fotos de los reportes y propone qué hay en ellas (fauna marina, cachiyuyo, algas invasoras),
con una idea central: **la IA sugiere, la persona confirma, y lo que se confirma es lo que la IA aprende.**

## Qué hace con cada foto
| Paso | Qué hace |
|---|---|
| Calidad | Avisa si está borrosa, oscura, sobreexpuesta o muy chica |
| Duplicados | Reconoce la misma foto aunque la recompriman o achiquen (huella perceptual + embedding) |
| EXIF | Lee la ubicación y fecha de la foto, para ofrecer usarla en el mapa |
| Predicción | Especie probable + confianza **calibrada**. Si no se parece a nada de lo aprendido, dice "no la reconozco" en vez de adivinar |
| Pista general | Con el modelo base (ImageNet): "parece un mamífero marino", aunque no sepa cuál |

## Cómo está armado
`foto → EfficientNet-B0 (ONNX, congelado) → embedding de 1280 números → cabeza entrenable (regresión logística)`.
El codificador no se toca; lo que se reentrena es la cabeza, que es liviana (segundos en una CPU) y por eso se puede
reentrenar cada vez que entren fotos nuevas.

## Puesta en marcha
```bash
cd ia
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn oceanos_ia.api:app --port 8000
```
En `frontend/` poné `VITE_IA_URL=http://localhost:8000` (ya está en `.env.development`) y `npm run dev`.
Para el **APK** la URL tiene que ser pública y **https**, y ese dominio hay que agregarlo en `OCEANOS_IA_ORIGENES`.

Tests: `pip install pytest httpx && pytest tests -q`

## Cómo sigue entrenándose
1. Alguien sube una foto en **Reportar**, confirma o corrige la especie → se guarda con su etiqueta (peso 0,5).
2. En **Verificar**, cada "Coincido" de la comunidad sobre un reporte con foto suma otra etiqueta (peso 1).
3. Una foto entra a entrenar cuando una etiqueta gana con peso ≥ 1 y ≥ 60 % de los votos. **Una sola persona no alcanza.**
4. `python entrenar.py` (o el botón de **/app/ia**, con `OCEANOS_IA_TOKEN`) entrena una versión nueva.
5. La versión nueva solo se publica si su F1 no es peor que la activa. `python entrenar.py --listar` / `--activar v0003` para volver atrás.

Una especie entra al modelo con 8 fotos (`OCEANOS_IA_MIN_EJEMPLOS`). Nuevas especies: agregalas a `oceanos_ia/taxonomia.json`.

### Cómo se mide (y por qué no se infla)
La validación es **agrupada**: los fotogramas de un mismo video o las fotos de un mismo reporte nunca se reparten entre
entrenamiento y prueba. Sin eso, un modelo "acierta" reconociendo la escena y no el animal. Una especie figura como
*validada* con ≥ 3 eventos distintos y precisión y recall ≥ 80 %.

## Estado actual: v0001 (leer esto)
Está sembrada con 168 fotogramas de los 5 videos del sitio, y las etiquetas (`datos/semilla/etiquetas.csv`) son una
primera aproximación **que hay que revisar**. Con un solo video por especie, el modelo reconoce lo parecido a esos
videos y **no generaliza**: la validación agrupada da 0 % y la app lo muestra así. Ante fotos que no vio, responde
"no la reconozco". Mejora con fotos reales de distintas salidas, no con más fotogramas del mismo video.
Para regenerar la semilla: `python sembrar_desde_videos.py` (necesita ffmpeg).

## Seguridad y privacidad
- **La verificación automática está apagada.** Tu sistema verifica y paga tokens cuando un reporte llega con `aiConfidence`
  alta. La IA solo manda ese número si activás `OCEANOS_IA_AUTOVERIFICAR=1` **y** el modelo está validado (todas las
  especies, F1 ≥ 0,9, ≥ 150 fotos) **y** la persona confirmó justo lo que sugirió **y** la foto es buena y no repetida.
- Las fotos se guardan re-codificadas (sin EXIF ni GPS) en `datos/imagenes/`. Avisá en la app que se guardan; el texto ya está en el cargador.
- Poné el servicio detrás de https y de un límite de pedidos (nginx, Cloudflare). No tiene login: las URLs de las fotos son difíciles de adivinar, no secretas.

## Variables de entorno
`OCEANOS_IA_TOKEN` (habilita reentrenar por API) · `OCEANOS_IA_ORIGENES` (CORS, separados por coma) · `OCEANOS_IA_DATOS` / `OCEANOS_IA_MODELOS` (carpetas persistentes) ·
`OCEANOS_IA_MIN_EJEMPLOS` · `OCEANOS_IA_UMBRAL_SUGERIR` · `OCEANOS_IA_AUTOVERIFICAR` · `OCEANOS_IA_MAX_BYTES`

## Licencias
Código propio. Codificador: pesos de EfficientNet-B0 de [lukemelas/EfficientNet-PyTorch](https://github.com/lukemelas/EfficientNet-PyTorch) (Apache-2.0),
convertidos con `construir_encoder.py`. Los pesos se entrenaron con ImageNet: si el uso es comercial, revisá sus términos.
No se usa código de Ultralytics/YOLO (AGPL-3.0) ni de repos sin licencia.

## Mejorar el modelo más adelante
Cuando haya cientos de fotos por especie conviene afinar el codificador en una GPU (Colab) o cambiarlo por uno más fuerte
(CLIP, DINOv2): solo se toca `oceanos_ia/encoder.py`; el resto del flujo no cambia.
