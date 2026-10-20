"""
pruebas_usuario_dao.py
----------------------
Punto 1.5: pruebas de la clase UsuarioDAO.

Ejecuta el CRUD completo y además fuerza a propósito los casos de error,
para demostrar que las excepciones se atrapan y el script NO se detiene.

Ejecutar con:  python pruebas_usuario_dao.py
"""

from usuario import Usuario
from usuario_dao import UsuarioDAO
from conexion import Conexion
from excepciones import ErrorAplicacion

resultados = {'ok': 0, 'atrapadas': 0}
ID_PRUEBA = None


def prueba(titulo, funcion):
    """Corre una prueba aislada: si falla, lo informa y sigue con la siguiente."""
    print(f'\n{"-" * 62}\n>> {titulo}\n{"-" * 62}')
    try:
        funcion()
        resultados['ok'] += 1
    except ErrorAplicacion as e:
        resultados['atrapadas'] += 1
        print(f'   [EXCEPCIÓN CONTROLADA] {type(e).__name__}: {e}')
    except Exception as e:
        resultados['atrapadas'] += 1
        print(f'   [EXCEPCIÓN INESPERADA] {type(e).__name__}: {e}')


# ============================== casos de prueba =============================

def listar():
    usuarios = UsuarioDAO.seleccionar()
    if not usuarios:
        print('   (la tabla está vacía)')
    for usuario in usuarios:
        print(f'   {usuario}')


def insertar_ok():
    global ID_PRUEBA
    usuario = Usuario(username='usuario_prueba', password='clave123')
    filas = UsuarioDAO.insertar(usuario)
    print(f'   Filas insertadas: {filas}')
    ID_PRUEBA = max(u.id_usuario for u in UsuarioDAO.seleccionar())
    print(f'   Id generado por la secuencia: {ID_PRUEBA}')


def insertar_username_vacio():
    """Debe lanzar ErrorValidacion antes de tocar la base."""
    UsuarioDAO.insertar(Usuario(username='', password='clave123'))


def insertar_password_vacio():
    """Debe lanzar ErrorValidacion."""
    UsuarioDAO.insertar(Usuario(username='pepito', password=''))


def actualizar_ok():
    usuario = Usuario(ID_PRUEBA, 'usuario_editado', 'clave456')
    filas = UsuarioDAO.actualizar(usuario)
    print(f'   Filas actualizadas: {filas} -> {usuario}')


def actualizar_inexistente():
    """Debe lanzar UsuarioNoEncontrado."""
    UsuarioDAO.actualizar(Usuario(999999, 'fantasma', 'clave789'))


def eliminar_ok():
    filas = UsuarioDAO.eliminar(Usuario(id_usuario=ID_PRUEBA))
    print(f'   Filas eliminadas: {filas}')


def eliminar_inexistente():
    """Debe lanzar UsuarioNoEncontrado."""
    UsuarioDAO.eliminar(Usuario(id_usuario=999999))


def eliminar_sin_id():
    """Debe lanzar UsuarioNoEncontrado (falta el id)."""
    UsuarioDAO.eliminar(Usuario())


def id_invalido():
    """Debe lanzar ErrorValidacion (id no numérico)."""
    Usuario(id_usuario='abc')


# ================================== main ====================================

def main():
    print('\n' + '=' * 62)
    print('   PRUEBAS DE LA CLASE UsuarioDAO')
    print('=' * 62)

    prueba('SELECT inicial', listar)
    prueba('INSERT correcto', insertar_ok)
    prueba('INSERT con username vacío (debe lanzar ErrorValidacion)', insertar_username_vacio)
    prueba('INSERT con password vacío (debe lanzar ErrorValidacion)', insertar_password_vacio)
    prueba('UPDATE correcto', actualizar_ok)
    prueba('UPDATE de id inexistente (debe lanzar UsuarioNoEncontrado)', actualizar_inexistente)
    prueba('Id no numérico (debe lanzar ErrorValidacion)', id_invalido)
    prueba('DELETE correcto', eliminar_ok)
    prueba('DELETE de id inexistente (debe lanzar UsuarioNoEncontrado)', eliminar_inexistente)
    prueba('DELETE sin id (debe lanzar UsuarioNoEncontrado)', eliminar_sin_id)
    prueba('SELECT final', listar)

    print('\n' + '=' * 62)
    print(f'   RESUMEN -> operaciones OK: {resultados["ok"]} | '
          f'excepciones atrapadas: {resultados["atrapadas"]}')
    print('   El script llegó hasta el final SIN detenerse.')
    print('=' * 62 + '\n')

    Conexion.cerrarConexiones()


if __name__ == '__main__':
    main()
