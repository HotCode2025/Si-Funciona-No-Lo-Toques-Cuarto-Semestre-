"""
cursor_del_pool.py
------------------
Context manager (`with`) que administra la conexión y el cursor obtenidos
del pool, tal como lo describe el UML de la cátedra.

    with CursorDelPool() as cursor:
        cursor.execute('SELECT * FROM usuario')

Hace COMMIT si todo salió bien, ROLLBACK si hubo excepción, y en un `finally`
cierra el cursor y devuelve la conexión al pool SIEMPRE.

Devuelve False en __exit__: no suprime la excepción, la deja subir para que
el DAO la traduzca a una excepción de la aplicación (punto 1.1).
"""

from conexion import Conexion
from logger_base import log


class CursorDelPool:

    def __init__(self):
        self._conn = None
        self._cursor = None

    def __enter__(self):
        log.debug('Inicio del método with y __enter__')
        self._conn = Conexion.obtenerConexion()
        self._cursor = self._conn.cursor()
        return self._cursor

    def __exit__(self, tipo_excepcion, valor_excepcion, detalle_excepcion):
        log.debug('Se ejecuta el método exit')
        try:
            if valor_excepcion is not None:
                self._conn.rollback()
                log.error(f'Ocurrió un problema, se ejecuta rollback: {valor_excepcion}')
            else:
                self._conn.commit()
                log.debug('Commit de la transacción')
        except Exception as e:
            # Ni el commit ni el rollback deben tumbar el programa.
            log.error(f'Error al cerrar la transacción: {e}')
        finally:
            if self._cursor is not None:
                try:
                    self._cursor.close()
                except Exception as e:
                    log.error(f'Error al cerrar el cursor: {e}')
            Conexion.liberarConexion(self._conn)

        return False
