// ============================================================
// CARRUSEL DE FOTOGRAFÍAS — José José
// ------------------------------------------------------------
// Hace que la fotografía del retrato (dentro del "vinilo" que gira)
// vaya cambiando sola cada cierto tiempo, con una pequeña transición.
// ============================================================

// Rutas de las imágenes que irán rotando dentro del retrato.
const fotos = [
  'assets/jose-jose-retrato-circular.jpeg',
  'assets/jose-jose-blanco-negro.jpeg',
  'assets/jose-jose-buscando-sonrisa.jpeg',
  'assets/jose-jose-en-concierto.jpeg',
  'assets/jose-jose-retrato-perfil.jpeg'
];

// Posición dentro de cada imagen que se mostrará (object-position).
// Cada foto tiene el rostro en un lugar distinto, así que ajustamos
// manualmente el encuadre para que siempre se vea bien recortado.
const encuadres = [
  'center center', // foto 1: centrada
  'center 28%',    // foto 2: elige un punto más abajo
  'center 14%',
  'center 25%',
  'center 40%'
];

// Seleccionamos el elemento <img> que mostrará las fotos.
const fotoCarrusel = document.querySelector('.foto-carrusel');
let indiceFoto = 0; // cuál foto se está mostrando ahora (0 = la primera)

// Aplicamos el encuadre de la primera foto justo al cargar.
if (fotoCarrusel) {
  fotoCarrusel.style.objectPosition = encuadres[0];
}

// Precarga de imágenes: creamos un <img> oculto por cada foto con su
// ruta como src. Así el navegador las descarga de una vez y el cambio
// de foto es instantáneo (sin parpadeo de carga).
fotos.forEach((ruta) => {
  const imagenPrecargada = document.createElement('img');
  imagenPrecargada.src = ruta;
});

// Cambia a la siguiente foto con una animación de salida/entrada.
function cambiarFoto() {
  // Añadimos la clase 'saliendo' (opacity 0 + rotación), definida en styles.css.
  fotoCarrusel.classList.add('saliendo');

  // Esperamos 450 ms (= duración de la animación) para hacer el cambio
  // mientras la foto se está "saliendo" de la vista.
  window.setTimeout(() => {
    indiceFoto = (indiceFoto + 1) % fotos.length; // avanzamos (y volvemos al inicio al llegar al final)
    fotoCarrusel.src = fotos[indiceFoto];          // cargamos la siguiente imagen
    fotoCarrusel.style.objectPosition = encuadres[indiceFoto]; // reajustamos el encuadre
    fotoCarrusel.classList.remove('saliendo');     // quitamos la clase para que vuelva a aparecer
  }, 450);
}

// Programamos el cambio de foto cada 2700 ms (2.7 segundos),
// solo si el elemento existe y hay más de una foto.
if (fotoCarrusel && fotos.length > 1) {
  window.setInterval(cambiarFoto, 2700);
}