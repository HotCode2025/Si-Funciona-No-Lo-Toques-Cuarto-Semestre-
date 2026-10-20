package UTN.conexion;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class Conexion {
    public static Connection getConnection(){
        Connection conexion = null;
        var baseDatos = "tup_progiv";
        var url = "jdbc:mysql://127.0.0.1:3306/"+baseDatos;
        var usuario = "root";
        var password = "";
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            conexion = DriverManager.getConnection(url, usuario, password);
        } catch (ClassNotFoundException | SQLException e){
            System.out.println("Ocurrio un error en la conexion:" + e.getMessage());
        }
        return conexion;
    }
}
