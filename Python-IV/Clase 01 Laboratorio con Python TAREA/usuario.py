"""
usuario.py
----------
Punto 1.3: clase entidad que mapea la tabla `usuario`.

El __str__ devuelve el mismo formato que se ve en la ejecución del video:

    Usuario: 1 jperez 123

Los "métodos Get/Set de cada atributo" del UML están hechos con `property`,
que es la forma pythónica de los getters/setters de Java. Cada setter valida
el dato y lanza ErrorValidacion (punto 1.1) en vez de dejar pasar basura.
"""

from excepciones import ErrorValidacion


class Usuario:

    def __init__(self, id_usuario=None, username=None, password=None):
        # Se asignan por las properties, así se validan siempre.
        self.id_usuario = id_usuario
        self.username = username
        self.password = password

    # ------------------------------- id_usuario -------------------------------
    @property
    def id_usuario(self):
        return self._id_usuario

    @id_usuario.setter
    def id_usuario(self, valor):
        if valor is None:                  # todavía no lo generó la secuencia
            self._id_usuario = None
            return
        try:
            valor = int(valor)
        except (TypeError, ValueError):
            raise ErrorValidacion(f'El id_usuario debe ser un número entero, llegó: {valor!r}')
        if valor <= 0:
            raise ErrorValidacion(f'El id_usuario debe ser mayor a cero, llegó: {valor}')
        self._id_usuario = valor

    # -------------------------------- username --------------------------------
    @property
    def username(self):
        return self._username

    @username.setter
    def username(self, valor):
        if valor is None:
            self._username = None
            return
        if not isinstance(valor, str):
            raise ErrorValidacion('El username debe ser texto.')
        valor = valor.strip()
        if valor == '':
            raise ErrorValidacion('El username no puede quedar vacío.')
        if ' ' in valor:
            raise ErrorValidacion('El username no puede tener espacios.')
        self._username = valor

    # -------------------------------- password --------------------------------
    @property
    def password(self):
        return self._password

    @password.setter
    def password(self, valor):
        if valor is None:
            self._password = None
            return
        if not isinstance(valor, str):
            raise ErrorValidacion('El password debe ser texto.')
        if valor.strip() == '':
            raise ErrorValidacion('El password no puede quedar vacío.')
        self._password = valor

    # --------------------------------- métodos --------------------------------
    def validar_para_persistir(self, requiere_id=False):
        """
        Chequea que el objeto esté completo antes de mandarlo a la base.
        requiere_id=False para INSERT, requiere_id=True para UPDATE y DELETE.
        """
        if requiere_id and self._id_usuario is None:
            raise ErrorValidacion('Falta el id_usuario para poder realizar la operación.')
        if not self._username:
            raise ErrorValidacion('El username es obligatorio.')
        if not self._password:
            raise ErrorValidacion('El password es obligatorio.')
        return True

    def __str__(self):
        return f'Usuario: {self._id_usuario} {self._username} {self._password}'

    def __repr__(self):
        return self.__str__()

    def __eq__(self, otro):
        if not isinstance(otro, Usuario):
            return NotImplemented
        return self._id_usuario == otro._id_usuario and self._username == otro._username

    def __hash__(self):
        return hash((self._id_usuario, self._username))


if __name__ == '__main__':
    usuario1 = Usuario(1, 'jperez', '123')
    print(usuario1)

    # Las validaciones NO cortan el script: cada una se atrapa y se informa.
    for datos in [(0, 'jperez', '123'), (2, '', '123'), (3, 'con espacio', '123'), (4, 'ok', '')]:
        try:
            print(Usuario(*datos))
        except ErrorValidacion as e:
            print(f'[VALIDACIÓN] {e}')
