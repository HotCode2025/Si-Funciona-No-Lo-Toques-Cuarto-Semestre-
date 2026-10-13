"""
conexion.py
-----------
Administra el pool de conexiones a PostgreSQL.

Los nombres de los métodos son los del UML de la cátedra:
obtenerPool, obtenerConexion, liberarConexion, cerrarConexiones.

AGREGADO DEL PUNTO 1.1: todo error de psycopg2 se traduce a ErrorConexion,
así el menú puede atraparlo y seguir corriendo.
"""

import psycopg2
from psycopg2 import pool

from logger_base import log
from excepciones import ErrorConexion


class Conexion:
    # ---------- Ajustá estos valores a tu instalación de PostgreSQL ----------
    _DATABASE = 'test_db'
    _USERNAME = 'postgres'
    _PASSWORD = 'admin'
    _DB_PORT = '5432'
    _HOST = '127.0.0.1'
    _MIN_CON = 1
    _MAX_CON = 5
    # ------------------------------------------------------------------------

    _pool = None

    @classmethod
    def obtenerPool(cls):
        """Devuelve el pool. Lo crea la primera vez que se lo pide."""
        if cls._pool is None:
            try:
                cls._pool = pool.SimpleConnectionPool(
                    cls._MIN_CON,
                    cls._MAX_CON,
                    host=cls._HOST,
                    user=cls._USERNAME,
                    password=cls._PASSWORD,
                    port=cls._DB_PORT,
                    database=cls._DATABASE
                )
                log.debug(f'creación del pool exitosa: {cls._pool}')
            except psycopg2.OperationalError as e:
                raise ErrorConexion(
                    'No se pudo crear el pool de conexiones. Verificá que el servicio '
                    f'de PostgreSQL esté levantado y que la base "{cls._DATABASE}", '
                    'el usuario y la contraseña sean correctos.', e)
            except Exception as e:
                raise ErrorConexion('Error inesperado al crear el pool de conexiones.', e)
        return cls._pool

    @classmethod
    def obtenerConexion(cls):
        """Saca una conexión prestada del pool."""
        try:
            conexion = cls.obtenerPool().getconn()
            log.debug(f'Conexión obtenida del pool: {conexion}')
            return conexion
        except ErrorConexion:
            raise                       # ya viene traducida, la dejamos pasar
        except Exception as e:
            raise ErrorConexion('No se pudo obtener una conexión del pool.', e)

    @classmethod
    def liberarConexion(cls, conexion):
        """Devuelve la conexión al pool."""
        if conexion is None:
            return
        try:
            cls.obtenerPool().putconn(conexion)
            log.debug(f'Regresamos la conexión del pool: {conexion}')
        except Exception as e:
            # Si falla liberar, NO tumbamos la app: solo lo registramos.
            log.error(f'No se pudo devolver la conexión al pool: {e}')

    @classmethod
    def cerrarConexiones(cls):
        """Cierra todo el pool. Se llama al salir de la aplicación."""
        if cls._pool is None:
            return
        try:
            cls._pool.closeall()
            log.debug('Todas las conexiones del pool fueron cerradas.')
        except Exception as e:
            log.error(f'Error al cerrar el pool de conexiones: {e}')
        finally:
            cls._pool = None


if __name__ == '__main__':
    # Prueba del pool: pedir conexiones, devolverlas y cerrar.
    try:
        conexion1 = Conexion.obtenerConexion()
        Conexion.liberarConexion(conexion1)

        conexion2 = Conexion.obtenerConexion()
        conexion3 = Conexion.obtenerConexion()
        Conexion.liberarConexion(conexion2)
        Conexion.liberarConexion(conexion3)

        log.info('Prueba del pool finalizada OK.')
    except ErrorConexion as e:
        log.error(f'Falló la prueba del pool: {e}')
    finally:
        Conexion.cerrarConexiones()
