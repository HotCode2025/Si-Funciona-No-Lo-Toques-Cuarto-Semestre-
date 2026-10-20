package UTN.datos;

import static UTN.conexion.Conexion.getConnection;
import UTN.dominio.Estudiante;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class EstudianteDAO {
    //metodo listar
    public List<Estudiante> listarEstudiantes(){
        List<Estudiante> estudiantes = new ArrayList<>();

        PreparedStatement ps;
        ResultSet rs;

        Connection con = getConnection();
        String query = "SELECT * FROM estudiantes";

        try {
            ps = con.prepareStatement(query);
            rs = ps.executeQuery();
            while (rs.next()){
                var estudiante = new Estudiante();
                estudiante.setIdEstudiante(rs.getInt("id_estudiante"));
                estudiante.setNombre(rs.getString("nombre"));
                estudiante.setApellido(rs.getString("apellido"));
                estudiante.setTelefono(rs.getString("telefono"));
                estudiante.setEmail(rs.getString("email"));

                estudiantes.add(estudiante);
            }
        } catch (SQLException e) {
            System.out.println("Error al seleccionar datos: " + e.getMessage());
        } finally {
            try{
                con.close();
            } catch (Exception e){
                System.out.println("Error al cerrar la conexión: " + e.getMessage());
            }
        }
        return estudiantes;
    }

    public boolean buscarEstudiantePorId(Estudiante estudiante){
        PreparedStatement ps;
        ResultSet rs;
        Connection con = getConnection();
        String query = "SELECT * FROM estudiantes WHERE id_estudiante = ?";
        try {
            ps = con.prepareStatement(query);
            ps.setInt(1, estudiante.getIdEstudiante());
            rs = ps.executeQuery();
            if (rs.next()){
                estudiante.setNombre(rs.getString("nombre"));
                estudiante.setApellido(rs.getString("apellido"));
                estudiante.setTelefono(rs.getString("telefono"));
                estudiante.setEmail(rs.getString("email"));
                return true;
            }
        } catch (SQLException e) {
            System.out.println("Error al buscar estudiante: " + e);
        } finally {
            try{
                con.close();
            } catch (Exception e){
                System.out.println("Error al cerrar la conexión: " + e.getMessage());
            }
        }
        return false;
    }

    public boolean agregarEstudiante(Estudiante estudiante){
        PreparedStatement ps;
        Connection con = getConnection();
        String SQL = "INSERT INTO estudiantes (nombre, apellido, telefono, email) VALUES (?, ?, ?, ?)";
        try {
            ps = con.prepareStatement(SQL);
            ps.setString(1, estudiante.getNombre());
            ps.setString(2, estudiante.getApellido());
            ps.setString(3, estudiante.getTelefono());
            ps.setString(4, estudiante.getEmail());
            ps.execute();
            return true;
        } catch (SQLException e) {
            System.out.println("Error al agregar estudiante: " + e);
        } finally {
            try{
                con.close();
            } catch (Exception e){
                System.out.println("Error al cerrar la conexión: " + e.getMessage());
            }
        }
        return false;
    }

    public boolean modificarEstudiante(Estudiante estudiante){
        PreparedStatement ps;
        Connection con = getConnection();
        String SQL = "UPDATE estudiantes SET nombre = ?, apellido = ?, telefono = ?, email = ? WHERE id_estudiante = ?";
        try {
            ps = con.prepareStatement(SQL);
            ps.setString(1, estudiante.getNombre());
            ps.setString(2, estudiante.getApellido());
            ps.setString(3, estudiante.getTelefono());
            ps.setString(4, estudiante.getEmail());
            ps.setInt(5, estudiante.getIdEstudiante());
            ps.execute();
            return true;
        } catch (SQLException e) {
            System.out.println("Error al modificar estudiante: " + e);
        } finally {
            try{
                con.close();
            } catch (Exception e){
                System.out.println("Error al cerrar la conexión: " + e.getMessage());
            }
        }
        return false;
    }

    public boolean eliminarEstudiante(Estudiante estudiante){
        PreparedStatement ps;
        Connection con = getConnection();
        String SQL = "DELETE FROM estudiantes WHERE id_estudiante = ?";
        try {
            ps = con.prepareStatement(SQL);
            ps.setInt(1, estudiante.getIdEstudiante());
            ps.execute();
            return true;
        } catch (SQLException e) {
            System.out.println("Error al eliminar estudiante: " + e);
        } finally {
            try{
                con.close();
            } catch (Exception e){
                System.out.println("Error al cerrar la conexión: " + e.getMessage());
            }
        }
        return false;
    }

    public static void main(String[] args) {
        var estudianteDao = new EstudianteDAO();
        // Modificar un estudiante:
//        var estudianteModificado = new Estudiante(1, "Juan Carlos", "Juarez", "12352512", "juancarlos@example.com");
//        var modificado = estudianteDao.modificarEstudiante(estudianteModificado);
//        if (modificado)
//            System.out.println("Estudiante modificado: " + estudianteModificado);
//        else
//            System.out.println("No se modifico el estudiante");

        // Buscar un estudiante por id:
//        var estudiante1 = new Estudiante(1);
//        System.out.println("Estudiantes antes de la busqueda: " + estudiante1);
//        var encontrado = estudianteDao.buscarEstudiantePorId(estudiante1);
//        if(encontrado){
//            System.out.println("Estudiante encontrado: " + estudiante1);
//        }
//        else{
//            System.out.println("No se encontro el estudiante: " + estudiante1.getIdEstudiante());
//        }
        // Cargar un estudiante:
//        var nuevoEstudiante = new Estudiante("Juan", "Perez", "12345i6345", "example@example.com");
//        var agregado = estudianteDao.agregarEstudiante(nuevoEstudiante);
//        if(agregado)
//            System.out.println("Estudiante agregado: " + nuevoEstudiante);
//        else
//            System.out.println("No se ha agregado estudiante: " + nuevoEstudiante);


        // Eliminar estudiante:
        var estudianteEliminado = new Estudiante(2);
        var eliminado = estudianteDao.eliminarEstudiante(estudianteEliminado);
        if (eliminado)
            System.out.println("Estudiante eliminado: " + estudianteEliminado);
        else
            System.out.println("No se ha eliminado al estudiante: " + estudianteEliminado);

        // Listar estudiantes:
        System.out.println("Listado de estudiantes");
        List<Estudiante> estudiantes = estudianteDao.listarEstudiantes();
        estudiantes.forEach(System.out::println);


    }
}
