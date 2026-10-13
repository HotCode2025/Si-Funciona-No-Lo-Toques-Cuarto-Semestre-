# **Quiz de hoy: Miércoles 19 de agosto del 2026**

GRUPO: Los Sin Chamba   
Integrantes:  Lautaro Martinez ,Gabriel Maculus, Leandro Orozco, Kevin Castilla,  Mariano Rasgido, Ezequiel Diaz, Samira Baz, Jose Rodriguez

## **Pregunta 1**

Tienes varios labels que le indican al usuario qué está seleccionando con diferentes inputs de tipo radio. Pero al darle click a los labels, sus inputs correspondientes NO se seleccionan. ¿Cómo solucionarías este problema?  
**Respuesta correcta: b**  
Asignando el mismo valor en el atributo id de los inputs y el atributo for de sus labels correspondientes.  
*Explicación:* El atributo for de la etiqueta \<label\> debe coincidir exactamente con el atributo id del \<input\>. Esto vincula ambos elementos para que, al hacer clic sobre el texto del label, se active o seleccione el input correspondiente.

## **Pregunta 2**

¿Qué etiqueta de HTML le permite a los usuarios escribir lo que ellos quieran?  
**Respuesta correcta: d**  
input  
*Explicación:* La etiqueta \<input\> crea un campo donde el usuario puede ingresar y escribir texto o información.

## **Pregunta 3**

¿Qué significa maquetar una página web?  
**Respuesta correcta: b**  
Escribir su estructura en HTML y CSS  
*Explicación:* Maquetar (o layouting) consiste en construir la estructura visual y organización de una página web definiendo sus elementos con HTML y aplicando sus estilos y diseño con CSS.

## **Pregunta 4**

Tienes el siguiente código HTML:  
\<button id="lanzar-ataque"\>¡Lanzar ataque\!\</button\>  
Necesitas ejecutar una alerta cada vez que los usuarios le den click a este botón. ¿Cómo lo harías?  
**Respuesta correcta: b**

**`let botonLanzarAtaque = document.getElementById('lanzar-ataque')`**

**`function enviarAlerta(){`**

    **`alert('Mensaje de la alerta')`**

**`}`**

**`botonLanzarAtaque.addEventListener('click', enviarAlerta())`**

*Explicación:* Representa la estructura y lógica adecuada para obtener el elemento del DOM, definir una función manejadora y registrar el evento. *Nota técnica: En JavaScript puro, el callback se pasa sin paréntesis enviarAlerta, pero de las opciones dadas, la 'b' es la que muestra el bloque conceptual más completo.*