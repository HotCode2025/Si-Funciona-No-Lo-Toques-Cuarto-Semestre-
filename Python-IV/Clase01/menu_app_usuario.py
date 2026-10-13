"""
menu_app_usuario.py
-------------------
Puntos 1.6 y 1.7: menú con las 5 opciones del UML.

Mismos textos y mismo flujo que el video de la clase, pero con el agregado
que pide el punto 1.1: LA APLICACIÓN NUNCA SE DETIENE POR UNA EXCEPCIÓN.

Tres diferencias respecto del código de la clase, todas por el punto 1.1:

  1. `int(input(...))` se reemplazó por `leer_entero()`. En el original,
     escribir una letra donde va un número tira ValueError y mata el proceso.
  2. Cada vuelta del while está dentro de un try/except, con un except por
     tipo de error para dar un mensaje distinto en cada caso.
  3. El `else` distingue la opción 5 (salir) de una opción inválida. En el
     original, cualquier número fuera de 1-4 imprimía "Salimos de la
     aplicación" pero el ciclo seguía dando vueltas igual.

Ejecutar con:  python menu_app_usuario.py
"""

from usuario import Usuario
from usuario_dao import UsuarioDAO
from conexion import Conexion
from logger_base import log
from excepciones import (ErrorAplicacion, ErrorValidacion, ErrorConexion,
                         ErrorDeDatos, UsuarioNoEncontrado)


def leer_entero(mensaje):
    """
    Lee un entero desde consola sin dejar que reviente el programa.
    Reemplaza al int(input(...)) pelado del código original.
    """
    valor = input(mensaje).strip()
    try:
        return int(valor)
    except ValueError:
        raise ErrorValidacion(f'"{valor}" no es un número entero válido.')


def main():
    opcion = None

    while opcion != 5:
        try:
            print('Opciones: ')
            print('1. Listar Usuarios')
            print('2. Agregar Usuario')
            print('3. Modificar Usuario')
            print('4. Eliminar Usuario')
            print('5. salir')
            opcion = leer_entero('Digite la opción (1-5): ')

            if opcion == 1:
                usuarios = UsuarioDAO.seleccionar()
                if not usuarios:
                    log.info('No hay usuarios cargados en la tabla.')
                for usuario in usuarios:
                    log.info(usuario)

            elif opcion == 2:
                username_var = input('Digite el nombre de usuario: ')
                password_var = input('Digite su contraseña: ')
                usuario = Usuario(username=username_var, password=password_var)
                usuario_insertado = UsuarioDAO.insertar(usuario)
                log.info(f'Usuario insertado: {usuario_insertado}')

            elif opcion == 3:
                id_usuario_var = leer_entero('Digite el id del usuario a modificar: ')
                username_var = input('Digite el nombre del usuario a modificar: ')
                password_var = input('Digite la contraseña del usuario a modificar: ')
                usuario = Usuario(id_usuario=id_usuario_var,
                                  username=username_var,
                                  password=password_var)
                usuario_actualizado = UsuarioDAO.actualizar(usuario)
                log.info(f'Usuario actualizado: {usuario_actualizado}')

            elif opcion == 4:
                id_usuario_var = leer_entero('Digite el id del usuario a eliminar: ')
                usuario = Usuario(id_usuario=id_usuario_var)
                usuario_eliminado = UsuarioDAO.eliminar(usuario)
                log.info(f'Usuario eliminado: {usuario_eliminado}')

            elif opcion == 5:
                log.info('Salimos de la aplicación, Hasta pronto!!!')

            else:
                log.warning(f'La opción {opcion} no existe. Elegí un número del 1 al 5.')

        # ---------- red 1: errores esperables, con mensaje entendible ----------
        except ErrorValidacion as e:
            log.warning(f'[DATOS INVÁLIDOS] {e}')
        except UsuarioNoEncontrado as e:
            log.warning(f'[NO ENCONTRADO] {e}')
        except ErrorConexion as e:
            log.error(f'[SIN CONEXIÓN] {e}')
            log.error('Revisá PostgreSQL y volvé a intentar. La aplicación sigue abierta.')
        except ErrorDeDatos as e:
            log.error(f'[ERROR DE BASE DE DATOS] {e}')

        # ---------- red 2: cualquier otra excepción nuestra ----------
        except ErrorAplicacion as e:
            log.error(f'[ERROR] {e}')

        # ---------- red 3: lo imprevisto y la salida con Ctrl+C ----------
        except KeyboardInterrupt:
            log.info('Interrumpido con Ctrl+C. Cerrando la aplicación...')
            break
        except Exception as e:
            log.critical(f'[ERROR INESPERADO] {type(e).__name__}: {e}', exc_info=True)
            log.critical('Quedó registrado en el log. La aplicación sigue funcionando.')

    # Pase lo que pase, liberamos los recursos.
    Conexion.cerrarConexiones()


if __name__ == '__main__':
    main()
