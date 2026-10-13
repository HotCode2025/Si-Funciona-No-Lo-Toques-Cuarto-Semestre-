# laboratorio_usuarios — Python + PostgreSQL

Implementación del laboratorio de usuario siguiendo **el UML de la cátedra**,
con el agregado que pide el punto 1.1: **excepciones para que la ejecución no
se detenga**.

---

## Qué se respetó del material de la cátedra

| Del material | Cómo quedó acá |
|---|---|
| Base de datos `test_db` | `_DATABASE = 'test_db'` en `conexion.py` |
| Tabla `usuario` (id_usuario serial PK, username y password varchar NOT NULL) | `script_bd.sql`, igual a la captura de pgAdmin |
| Datos `jperez/123` y `kgomez/456` | mismos INSERT del video |
| `obtenerPool`, `obtenerConexion`, `liberarConexion`, `cerrarConexiones` | mismos nombres del UML |
| `CursorDelPool` con `__init__`, `__enter__`, `__exit__` | igual |
| Constantes `SELECCIONAR`, `INSERTAR`, `ACTUALIZAR`, `ELIMINAR` | igual |
| Métodos `seleccionar`, `insertar`, `actualizar`, `eliminar` | igual |
| Menú de **5 opciones** con los textos del video | igual, palabra por palabra |
| `__str__` → `Usuario: 1 jperez 123` | igual |
| Formato de log `01:25:06 PM:DEBUG [conexion.py:34] ...` | igual |

La salida por consola queda **idéntica a la del video**. Podés correr el
proyecto al lado del video y comparar línea por línea.

---

## Estructura

| Archivo | Punto | Qué hace |
|---|---|---|
| `uml_usuario.mermaid` / `uml_usuario.puml` | 1.1 | UML de la cátedra + las excepciones agregadas |
| `excepciones.py` | 1.1 | Jerarquía de excepciones propias |
| `script_bd.sql` | 1.2 | Base, tabla y datos de prueba |
| `conexion.py` | 1.2 | Pool de conexiones |
| `cursor_del_pool.py` | 1.2 | Context manager con COMMIT / ROLLBACK |
| `usuario.py` | 1.3 | Clase entidad con get/set y validaciones |
| `usuario_dao.py` | 1.4 | CRUD sobre la tabla |
| `pruebas_usuario_dao.py` | 1.5 | Pruebas automáticas del DAO |
| `menu_app_usuario.py` | 1.6 / 1.7 | Menú con las 5 opciones |
| `logger_base.py` | — | Configuración de logging |

---

## Detalle de cada archivo

- `conexion.py`: gestiona el pool de conexiones a PostgreSQL. Crea el pool la primera vez, presta conexiones y las devuelve, y cierra todo al terminar.
- `cursor_del_pool.py`: contexto `with` para ejecutar sentencias SQL. Abre cursor y conexión, hace `COMMIT` si no hay error o `ROLLBACK` si falla, y siempre libera la conexión.
- `excepciones.py`: define todas las excepciones de la aplicación para separar errores de la base de datos de errores de negocio.
- `usuario.py`: clase `Usuario` que valida `id_usuario`, `username` y `password` antes de permitir persistir datos.
- `usuario_dao.py`: DAO que ejecuta SQL, convierte filas en objetos `Usuario`, y traduce errores del driver a excepciones propias.
- `menu_app_usuario.py`: interfaz de consola. Muestra el menú, lee la opción y llama a la función correspondiente.
- `pruebas_usuario_dao.py`: script que ejecuta casos de prueba del DAO y verifica que los errores se manejen sin cortar la ejecución.
- `logger_base.py`: configura el logger que usan todos los módulos para escribir en `capa_datos_usuario.log`.
- `script_bd.sql`: crea la tabla `usuario`, aplica constraints y carga datos de prueba.
- `uml_usuario.mermaid` / `uml_usuario.puml`: diagrama de clases del modelo y las relaciones.

## Flujo general de la aplicación

1. El usuario ejecuta `python menu_app_usuario.py`.
2. El menú muestra opciones y elige una acción.
3. Cada opción construye un objeto `Usuario` o toma un `id_usuario`.
4. El menú llama a un método de `UsuarioDAO`.
5. `UsuarioDAO` usa `CursorDelPool` para abrir cursor y ejecutar SQL.
6. `CursorDelPool` maneja transacción y libera recursos.
7. Si hay un error, se lanza una excepción propia y el menú la muestra sin cerrar la app.

---

## Puesta en marcha

```bash
pip install -r requirements.txt
```

En pgAdmin creá la base **`test_db`** y ejecutá `script_bd.sql` dentro de ella.
Después, en `conexion.py`, poné tu contraseña real de postgres:

```python
_DATABASE = 'test_db'
_USERNAME = 'postgres'
_PASSWORD = 'admin'      # <-- cambiá esto
```

Y a correr:

```bash
python conexion.py               # prueba el pool
python usuario.py                # prueba las validaciones de la entidad
python pruebas_usuario_dao.py    # prueba el CRUD completo (punto 1.5)
python menu_app_usuario.py       # la aplicación (puntos 1.6 y 1.7)
```

> **Nota sobre los imports.** Acá los archivos están planos en una sola
> carpeta (`from usuario import Usuario`), tal como los agrupa el UML dentro
> del paquete `laboratorio_usuarios`. En el video el profe usa un paquete
> (`from capa_datos_persona.Usuario import Usuario`). Si les exige esa
> estructura, metan los archivos en una subcarpeta con `__init__.py` y
> agreguen el prefijo del paquete a los imports. Nada más cambia.

---

## Punto 1.1: por qué la ejecución no se detiene

Hay **tres redes de contención**:

1. **La entidad y el DAO traducen los errores.** Ningún `psycopg2.Error`
   crudo llega al menú: se convierte en `ErrorConexion`, `ErrorDeDatos`,
   `UsuarioNoEncontrado` o `ErrorValidacion`, todas hijas de `ErrorAplicacion`.
2. **`CursorDelPool.__exit__`** hace ROLLBACK si hubo excepción y libera la
   conexión en un `finally`. Los recursos se devuelven al pool siempre.
3. **El `while` del menú** atrapa cada tipo por separado, más
   `KeyboardInterrupt` para Ctrl+C y un `except Exception` final para lo
   imprevisto, que lo registra en el log y vuelve a mostrar el menú.

### Tres cosas que en el código de la clase cortaban la ejecución

| Situación | Antes | Ahora |
|---|---|---|
| Escribir una letra en `Digite la opción` | `ValueError` y el proceso muere | `[DATOS INVÁLIDOS] "abc" no es un número entero válido.` y sigue |
| Modificar o eliminar un id que no existe | devuelve 0 en silencio, parece que funcionó | `[NO ENCONTRADO] No existe ningún usuario con el id 999` |
| PostgreSQL apagado | `OperationalError` y el proceso muere | `[SIN CONEXIÓN] ...` y el menú sigue disponible |

Además, en el original cualquier número fuera de 1–4 imprimía "Salimos de la
aplicación" pero el ciclo seguía dando vueltas igual, porque el `while` compara
contra 5. Acá la opción 5 y las opciones inválidas están separadas.

---

## La demo para el zoom

Esta es la que mejor muestra el punto 1.1:

1. Arrancá `python menu_app_usuario.py` con **PostgreSQL apagado**.
   La app abre igual, avisa `[SIN CONEXIÓN]` y **vuelve a mostrar el menú**.
2. Sin cerrar nada, levantá el servicio de PostgreSQL.
3. Elegí la opción 1 de nuevo: lista los usuarios como si nada.

Está probado: la app sobrevive al servicio caído y se recupera sola, sin
reiniciar el proceso.

Después, para completar, escribí `abc` en la opción, pedí modificar el id 999
y agregá un usuario con el nombre vacío. Ninguna de las tres corta el programa.

**Resultado de `pruebas_usuario_dao.py` contra la base real: 5 operaciones OK
y 6 excepciones atrapadas, el script llega al final sin detenerse.**

---

## Ver el UML

- **Mermaid** (`uml_usuario.mermaid`): pegalo en <https://mermaid.live> y
  exportás PNG o SVG.
- **PlantUML** (`uml_usuario.puml`): pegalo en
  <https://www.plantuml.com/plantuml>. Este calca mejor el diagrama original,
  con las cajas de "Responsabilidades" y todo lo agregado marcado con
  `>>> AGREGADO 1.1 <<<`, así el profe ve de una qué es nuevo.

---

## Reparto para el grupo

Los puntos 1.2 y 1.6 son grupales. Una división que funciona:

- **UML + excepciones (1.1)** → uno arma el diagrama y define la jerarquía;
  el resto revisa que sus clases lancen lo que corresponde.
- **Base de datos (1.2)** → uno hace el script y verifica que a todos les
  levante igual.
- **Entidad + DAO (1.3 y 1.4)** → de a dos, porque el DAO depende de la entidad.
- **Menú (1.6)** → una opción por integrante; las cinco siguen el mismo molde
  dentro del `if/elif`, así que se pueden trabajar en paralelo.
- **Pruebas (1.5 y 1.7)** → alguien que no haya escrito el DAO, para que las
  pruebas sean honestas.
