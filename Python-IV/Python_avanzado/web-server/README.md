# Archivo requirements.txt

Vamos a ver este archivo, este gestiona todas las dependencias y en qué versiones se necesitan, vamos a dejar aquí los comandos para alguien logre contribuir en este proyecto, los comandos son los siguientes:

```sh
# 1. Crear el entorno virtual (este no se comparte desde GitHub)
python3 -m venv env

# 2. Activar el entorno en Linux/WSL
source env/bin/activate

# 3. Instalar las dependencias exactas del proyecto
pip3 install -r requirements.txt

# 4. Ejecutar el programa
python3 main.py