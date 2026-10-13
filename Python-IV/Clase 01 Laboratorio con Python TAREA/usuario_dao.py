"""
usuario_dao.py
--------------
Punto 1.4: DAO (Data Access Object) sobre la entidad Usuario.

Tiene exactamente las constantes y los métodos del UML de la cátedra:
SELECCIONAR / INSERTAR / ACTUALIZAR / ELIMINAR y
seleccionar / insertar / actualizar / eliminar.

AGREGADO DEL PUNTO 1.1: cada método atrapa los errores de psycopg2 y los
traduce a excepciones nuestras. Además, si un UPDATE o DELETE no afecta
ninguna fila, lanza UsuarioNoEncontrado en vez de devolver 0 en silencio.
"""

import psycopg2

from cursor_del_pool import CursorDelPool
from usuario import Usuario
from logger_base import log
from excepciones import ErrorAplicacion, ErrorDeDatos, UsuarioNoEncontrado


class UsuarioDAO:
    """DAO para realizar el CRUD sobre la tabla usuario."""

    _SELECCIONAR = 'SELECT * FROM usuario ORDER BY id_usuario'
    _INSERTAR = 'INSERT INTO usuario(username, password) VALUES(%s, %s)'
    _ACTUALIZAR = 'UPDATE usuario SET username=%s, password=%s WHERE id_usuario=%s'
    _ELIMINAR = 'DELETE FROM usuario WHERE id_usuario=%s'

    # ------------------------------------------------------------------ SELECT
    @classmethod
    def seleccionar(cls):
        """Devuelve una lista de objetos Usuario. Si la tabla está vacía, lista vacía."""
        try:
            with CursorDelPool() as cursor:
                log.debug('Seleccionando usuarios')
                cursor.execute(cls._SELECCIONAR)
                registros = cursor.fetchall()
                usuarios = [Usuario(registro[0], registro[1], registro[2])
                            for registro in registros]
                return usuarios
        except ErrorAplicacion:
            raise
        except psycopg2.Error as e:
            raise ErrorDeDatos('No se pudo recuperar el listado de usuarios.', e)
        except Exception as e:
            raise ErrorDeDatos('Error inesperado al listar los usuarios.', e)

    # ------------------------------------------------------------------ INSERT
    @classmethod
    def insertar(cls, usuario):
        """Inserta el usuario. Devuelve la cantidad de filas afectadas."""
        usuario.validar_para_persistir(requiere_id=False)
        try:
            with CursorDelPool() as cursor:
                log.debug(f'Usuario a insertar: {usuario}')
                valores = (usuario.username, usuario.password)
                cursor.execute(cls._INSERTAR, valores)
                return cursor.rowcount
        except ErrorAplicacion:
            raise
        except psycopg2.errors.UniqueViolation as e:
            raise ErrorDeDatos(
                f'Ya existe un usuario con el username "{usuario.username}".', e)
        except psycopg2.Error as e:
            raise ErrorDeDatos('No se pudo insertar el usuario.', e)
        except Exception as e:
            raise ErrorDeDatos('Error inesperado al insertar el usuario.', e)

    # ------------------------------------------------------------------ UPDATE
    @classmethod
    def actualizar(cls, usuario):
        """Actualiza username y password. Devuelve la cantidad de filas afectadas."""
        usuario.validar_para_persistir(requiere_id=True)
        try:
            with CursorDelPool() as cursor:
                log.debug(f'Usuario a actualizar: {usuario}')
                valores = (usuario.username, usuario.password, usuario.id_usuario)
                cursor.execute(cls._ACTUALIZAR, valores)
                filas = cursor.rowcount
        except ErrorAplicacion:
            raise
        except psycopg2.errors.UniqueViolation as e:
            raise ErrorDeDatos(
                f'Ya existe otro usuario con el username "{usuario.username}".', e)
        except psycopg2.Error as e:
            raise ErrorDeDatos('No se pudo actualizar el usuario.', e)
        except Exception as e:
            raise ErrorDeDatos('Error inesperado al actualizar el usuario.', e)

        if filas == 0:
            raise UsuarioNoEncontrado(
                f'No existe ningún usuario con el id {usuario.id_usuario}, '
                'no se actualizó nada.')
        return filas

    # ------------------------------------------------------------------ DELETE
    @classmethod
    def eliminar(cls, usuario):
        """Elimina por id_usuario. Devuelve la cantidad de filas afectadas."""
        if usuario.id_usuario is None:
            raise UsuarioNoEncontrado('Falta el id_usuario para poder eliminar.')
        try:
            with CursorDelPool() as cursor:
                log.debug(f'Usuario a eliminar: {usuario}')
                valores = (usuario.id_usuario,)
                cursor.execute(cls._ELIMINAR, valores)
                filas = cursor.rowcount
        except ErrorAplicacion:
            raise
        except psycopg2.Error as e:
            raise ErrorDeDatos('No se pudo eliminar el usuario.', e)
        except Exception as e:
            raise ErrorDeDatos('Error inesperado al eliminar el usuario.', e)

        if filas == 0:
            raise UsuarioNoEncontrado(
                f'No existe ningún usuario con el id {usuario.id_usuario}, '
                'no se eliminó nada.')
        return filas
