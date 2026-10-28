# Usamos una imagen oficial y ligera de Python
FROM python:3.10

# Definimos el directorio de trabajo dentro del contenedor
WORKDIR /code

# Copiamos primero el archivo de dependencias
COPY requirements.txt /code/requirements.txt

# Instalamos las dependencias del proyecto
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copiamos todo el resto del código del servidor web al contenedor
COPY . /code

# Exponemos el puerto 8000 para acceder a FastAPI
EXPOSE 8000

# Comando para ejecutar la aplicación con Uvicorn
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]