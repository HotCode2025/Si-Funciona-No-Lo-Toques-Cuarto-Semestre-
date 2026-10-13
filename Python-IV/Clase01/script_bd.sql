-- =========================================================================
-- script_bd.sql  |  Punto 1.2 del laboratorio
-- Base de datos: test_db   |   Motor: PostgreSQL
--
-- Replica exactamente la tabla de las capturas de pgAdmin:
--   id_usuario  serial              NOT NULL, PRIMARY KEY
--   username    character varying   NOT NULL
--   password    character varying   NOT NULL
-- =========================================================================

-- ------------------------------------------------------------------
-- PASO 1: crear la base. Ejecutar conectado a la base "postgres",
-- NO dentro de test_db. En pgAdmin: click derecho en Databases > Create.
-- ------------------------------------------------------------------
-- CREATE DATABASE test_db;

-- ------------------------------------------------------------------
-- PASO 2: conectarse a test_db y ejecutar todo lo que sigue.
-- En psql:  \c test_db
-- ------------------------------------------------------------------

DROP TABLE IF EXISTS usuario;

CREATE TABLE usuario (
    id_usuario  SERIAL            NOT NULL,
    username    CHARACTER VARYING NOT NULL,
    password    CHARACTER VARYING NOT NULL,
    CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario)
);

-- ------------------------------------------------------------------
-- PASO 3: los mismos datos de prueba que se ven en el video
-- ------------------------------------------------------------------
INSERT INTO usuario (username, password) VALUES
    ('jperez', '123'),
    ('kgomez', '456');

-- ------------------------------------------------------------------
-- PASO 4: verificación
-- ------------------------------------------------------------------
SELECT * FROM usuario ORDER BY id_usuario;


-- =========================================================================
-- OPCIONAL: restricción UNIQUE sobre username
--
-- La tabla de la cátedra NO la tiene. Si la agregás, el DAO ya está
-- preparado: atrapa psycopg2.errors.UniqueViolation y avisa que el
-- username ya existe, en vez de cortar la ejecución.
-- Es un buen caso extra para mostrar el punto 1.1.
-- =========================================================================
-- ALTER TABLE usuario ADD CONSTRAINT usuario_username_key UNIQUE (username);


-- =========================================================================
-- Consultas útiles para la defensa
-- =========================================================================
-- Ver la estructura de la tabla:
--     \d usuario
--
-- Reiniciar la secuencia del id si hiciste muchas pruebas:
--     ALTER SEQUENCE usuario_id_usuario_seq RESTART WITH 3;
