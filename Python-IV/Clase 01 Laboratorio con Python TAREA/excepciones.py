"""
excepciones.py
--------------
Punto 1.1: jerarquía de excepciones propias.

Esta es la clase que HAY QUE AGREGARLE al UML de la cátedra. La idea es que
ningún error crudo de psycopg2 llegue al menú: el DAO lo traduce a una
excepción nuestra, con mensaje entendible, y el menú la atrapa y sigue.

    Exception
     |-- ErrorAplicacion              (base de todo lo nuestro)
          |-- ErrorConexion           no se pudo crear el pool / conectar
          |-- ErrorDeDatos            falló una sentencia SQL
          |-- ErrorValidacion         datos inválidos en la entidad o en el menú
          |-- UsuarioNoEncontrado     el id no existe en la tabla
"""


class ErrorAplicacion(Exception):
    """Excepción base. Todo lo que la app sabe manejar hereda de acá."""

    def __init__(self, mensaje, causa=None):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.causa = causa

    def __str__(self):
        if self.causa is not None:
            return f'{self.mensaje} (causa: {type(self.causa).__name__}: {self.causa})'
        return self.mensaje


class ErrorConexion(ErrorAplicacion):
    """No se pudo crear el pool, obtener o liberar una conexión."""


class ErrorDeDatos(ErrorAplicacion):
    """Falló la ejecución de una sentencia SQL."""


class ErrorValidacion(ErrorAplicacion):
    """Los datos cargados no son válidos."""


class UsuarioNoEncontrado(ErrorAplicacion):
    """No existe un usuario con el id indicado."""
