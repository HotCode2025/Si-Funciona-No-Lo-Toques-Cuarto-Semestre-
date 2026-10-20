package utn.tienda_libros;

import org.springframework.boot.SpringApplication;
<<<<<<< HEAD
import org.springframework.boot.autoconfigure.SpringBootApplication;
=======
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import utn.tienda_libros.vista.LibroFrom;

import java.awt.EventQueue;
>>>>>>> d564aa40c30a9538e701c1134388af46763e9491

@SpringBootApplication
public class TiendaLibrosApplication {

	public static void main(String[] args) {
<<<<<<< HEAD
		SpringApplication.run(TiendaLibrosApplication.class, args);
	}

=======
		ConfigurableApplicationContext contextoSpring =
				new SpringApplicationBuilder(TiendaLibrosApplication.class)
						.headless(false)
						.web(WebApplicationType.NONE)
						.run(args);

		// Ejecutamos
		EventQueue.invokeLater(() -> {
			LibroFrom libroFrom = contextoSpring.getBean(LibroFrom.class);
			libroFrom.setVisible(true);

		});
	}
>>>>>>> d564aa40c30a9538e701c1134388af46763e9491
}
