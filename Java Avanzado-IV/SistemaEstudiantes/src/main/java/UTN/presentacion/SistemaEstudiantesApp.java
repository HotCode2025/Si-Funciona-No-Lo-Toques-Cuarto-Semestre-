package UTN.presentacion;

import UTN.datos.EstudianteDAO;
import UTN.dominio.Estudiante;

import java.util.List;
import java.util.Scanner;

public class SistemaEstudiantesApp {
    public static void main(String[] args){
        var salir = false;
        var consola = new Scanner(System.in);
        var estudianteDao = new EstudianteDAO();
        while(!salir){
            try {
                mostrarMenu();
                salir = ejecutarOpciones(consola, estudianteDao);
            } catch (Exception e){
                System.out.println("Ocurrio un error al ejecutar la operacion: " + e.getMessage());
            }
        }
    }

private static void mostrarMenu(){
    System.out.print("""
            *************** Sistema de Estudiantes ***************
            
            1. Listar Estudiantes
            2. Buscar Estudiante
            3. Agregar Estudiante
            4. Modificar Estudiante
            5. Eliminar Estudiante
            6. Salir
            
            Elige una opción...
            
            """);
}

private static boolean ejecutarOpciones(Scanner consola, EstudianteDAO estudianteDao){
    var opcion = Integer.parseInt(consola.nextLine());
    var salir = false;
    switch (opcion){
        case 1 -> {
            System.out.println("Listando estudiantes");
            List<Estudiante> estudiantes = estudianteDao.listarEstudiantes();
            estudiantes.forEach(System.out::println);
        }
        case 2 -> {
            System.out.println("Se selecciono la opcion 2: Buscar Estudiante.");
            System.out.println("Ingrese el ID del estudiante a buscar: ");
            var idEstudiante = Integer.parseInt(consola.nextLine());
            var busqueda = new Estudiante(idEstudiante);
            var encontrado = estudianteDao.buscarEstudiantePorId(busqueda);
            if(encontrado){
                System.out.println("Estudiante encontrado: " + busqueda);
            }
            else{
                System.out.println("No se encontro el estudiante con ID: " + busqueda.getIdEstudiante());
            }
        }
        case 3 -> {
            System.out.println("Se selecciono la opcion 3: Agregar Estudiante.");
            System.out.println("Ingrese el nombre a continuacion:");
            var nombre = consola.nextLine();
            System.out.println("Ingrese el apellido a continuacion:");
            var apellido = consola.nextLine();
            System.out.println("Ingrese el telefono a continuacion:");
            var telefono = consola.nextLine();
            System.out.println("Ingrese el e-mail a continuacion:");
            var email = consola.nextLine();
            var nuevoEstudiante = new Estudiante(nombre, apellido, telefono, email);
            var agregado = estudianteDao.agregarEstudiante(nuevoEstudiante);
            if(agregado)
                System.out.println("Estudiante agregado: " + nuevoEstudiante);
            else
                System.out.println("No se ha agregado estudiante: " + nuevoEstudiante);
        }
        case 4 -> {
            System.out.println("Se selecciono la opcion 4: Modificar Estudiante.");
            System.out.println("Ingrese el ID a continuaciono o 0 para volver al menu anterior:");
            var idEstudiante = Integer.parseInt(consola.nextLine());
            if (idEstudiante == 0) {
                System.out.println("Volviendo al menu principal..");
                break;
            }
            var busqueda = new Estudiante(idEstudiante);
            var encontrado = estudianteDao.buscarEstudiantePorId(busqueda);
            if (!encontrado){
                System.out.println("El estudiante que intentas modificar no existe");
                break;
            }
            System.out.println("Ingrese el nombre a continuacion:");
            var nombre = consola.nextLine();
            System.out.println("Ingrese el apellido a continuacion:");
            var apellido = consola.nextLine();
            System.out.println("Ingrese el telefono a continuacion:");
            var telefono = consola.nextLine();
            System.out.println("Ingrese el e-mail a continuacion:");
            var email = consola.nextLine();
            var estudianteModificado = new Estudiante(idEstudiante ,nombre, apellido, telefono, email);
            var modificado = estudianteDao.modificarEstudiante(estudianteModificado);
            if (modificado)
                System.out.println("Estudiante modificado: " + estudianteModificado);
            else
                System.out.println("No se modifico el estudiante");
        }
        case 5 -> {
            System.out.println("Se selecciono la opcion 4: Eliminar Estudiante.");
            System.out.println("Ingrese el ID a continuacion o 0 para volver al menu anterior:");
            var idEstudiante = Integer.parseInt(consola.nextLine());
            if (idEstudiante == 0)
                break;
            var aEliminar = new Estudiante(idEstudiante);
            var encontrado = estudianteDao.buscarEstudiantePorId(aEliminar);
            if(encontrado){
                System.out.println("Estudiante eliminado: " + aEliminar);
            }
            else{
                System.out.println("No se pudo eliminar al estudiante: " + aEliminar.getIdEstudiante());
            }
        }
        case 6 -> {
            System.out.println("Saliendo...");
            salir = true;
        }
        default -> {
            System.out.println("Opcion invalida, intente otra vez..");
        }
    }
    return salir;
}
}
