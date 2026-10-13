-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: localhost
-- Tiempo de generación: 13-08-2026 a las 07:03:39
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `tup_progiv`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `estudiantes`
--

CREATE TABLE IF NOT EXISTS `estudiantes` (
  `id_estudiante` int(11) NOT NULL,
  `nombre` varchar(25) NOT NULL,
  `apellido` varchar(25) NOT NULL,
  `telefono` varchar(15) NOT NULL,
  `email` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `estudiantes`
--

INSERT INTO `estudiantes` (`id_estudiante`, `nombre`, `apellido`, `telefono`, `email`) VALUES
(1, 'Juan', 'Perez', '11111111', 'estudiante1@example.com'),
(2, 'Maria', 'Gomez', '22222222', 'estudiante2@example.com'),
(3, 'Luis', 'Rodriguez', '33333333', 'estudiante3@example.com'),
(4, 'Ana', 'Martinez', '44444444', 'estudiante4@example.com'),
(5, 'Carlos', 'Hernandez', '55555555', 'estudiante5@example.com'),
(6, 'Lucia', 'Lopez', '66666666', 'estudiante6@example.com'),
(7, 'Jorge', 'Diaz', '77777777', 'estudiante7@example.com'),
(8, 'Elena', 'Torres', '88888888', 'estudiante8@example.com'),
(9, 'Pedro', 'Ramirez', '99999999', 'estudiante9@example.com'),
(10, 'Sofia', 'Flores', '10101010', 'estudiante10@example.com'),
(11, 'Diego', 'Sanchez', '11112222', 'estudiante11@example.com'),
(12, 'Valentina', 'Ruiz', '22223333', 'estudiante12@example.com'),
(13, 'Javier', 'Jimenez', '33334444', 'estudiante13@example.com'),
(14, 'Camila', 'Alvarez', '44445555', 'estudiante14@example.com'),
(15, 'Andres', 'Moreno', '55556666', 'estudiante15@example.com'),
(16, 'Paula', 'Muñoz', '66667777', 'estudiante16@example.com'),
(17, 'Sebastian', 'Rojas', '77778888', 'estudiante17@example.com'),
(18, 'Daniela', 'Ortega', '88889999', 'estudiante18@example.com'),
(19, 'Gabriel', 'Castro', '99990000', 'estudiante19@example.com'),
(20, 'Natalia', 'Vargas', '10102020', 'estudiante20@example.com'),
(21, 'Mateo', 'Molina', '11113333', 'estudiante21@example.com'),
(22, 'Isabella', 'Silva', '22224444', 'estudiante22@example.com'),
(23, 'Nicolas', 'Paredes', '33335555', 'estudiante23@example.com'),
(24, 'Mariana', 'Castillo', '44446666', 'estudiante24@example.com'),
(25, 'Lucas', 'Reyes', '55557777', 'estudiante25@example.com'),
(26, 'Antonella', 'Morales', '66668888', 'estudiante26@example.com'),
(27, 'Felipe', 'Ortiz', '77779999', 'estudiante27@example.com'),
(28, 'Sara', 'Herrera', '88880000', 'estudiante28@example.com'),
(29, 'Tomas', 'Medina', '99991111', 'estudiante29@example.com'),
(30, 'Luciana', 'Aguilar', '10103030', 'estudiante30@example.com'),
(31, 'Benjamin', 'Cabrera', '11114444', 'estudiante31@example.com'),
(32, 'Victoria', 'Salas', '22225555', 'estudiante32@example.com'),
(33, 'Agustin', 'Campos', '33336666', 'estudiante33@example.com'),
(34, 'Martina', 'Fuentes', '44447777', 'estudiante34@example.com'),
(35, 'Joaquin', 'Ramos', '55558888', 'estudiante35@example.com'),
(36, 'Emilia', 'Navarro', '66669999', 'estudiante36@example.com'),
(37, 'Ignacio', 'Rios', '77770000', 'estudiante37@example.com'),
(38, 'Matias', 'Sandoval', '88881111', 'estudiante38@example.com'),
(39, 'Abril', 'Carrasco', '99992222', 'estudiante39@example.com'),
(40, 'Santiago', 'Cortez', '10104040', 'estudiante40@example.com'),
(41, 'Zoe', 'Guzman', '11115555', 'estudiante41@example.com'),
(42, 'Facundo', 'Suarez', '22226666', 'estudiante42@example.com'),
(43, 'Alma', 'Soto', '33337777', 'estudiante43@example.com'),
(44, 'Julian', 'Perez', '44448888', 'estudiante44@example.com'),
(45, 'Renata', 'Luna', '55559999', 'estudiante45@example.com'),
(46, 'Bautista', 'Cardenas', '66660000', 'estudiante46@example.com'),
(47, 'Julieta', 'Figueroa', '77771111', 'estudiante47@example.com'),
(48, 'Valentin', 'Villalba', '88882222', 'estudiante48@example.com'),
(49, 'Mia', 'Romero', '99993333', 'estudiante49@example.com'),
(50, 'Maximo', 'Acosta', '10105050', 'estudiante50@example.com');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `estudiantes`
--
ALTER TABLE `estudiantes`
  ADD PRIMARY KEY (`id_estudiante`),
  ADD UNIQUE KEY `id_estudiante` (`id_estudiante`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `estudiantes`
--
ALTER TABLE `estudiantes`
  MODIFY `id_estudiante` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
