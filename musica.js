// ============================================================
// MÚSICA DE FONDO — José José
// ------------------------------------------------------------
// Este archivo controla la lista de canciones que suenan de fondo
// mientras el visitante navega por la página.
//
// RENDIMIENTO (misma lógica que en la página de Juan Gabriel):
//   - Al cargar se descarga SOLO la primera canción (audioFondo.load()).
//   - La siguiente canción arranca su descarga únicamente cuando se
//     inicia el crossfade (2 s antes de que termine la actual), así que
//     NUNCA se descargan varias canciones "de sopetón".
//   - Al completarse el fundido, la canción anterior se libera de la
//     memoria del navegador (src="" + load()).
//   Lo máximo que existe cargado a la vez son las ~2 canciones que se
//   solapan durante el crossfade.
// ============================================================

// Duración del fundido entre canciones (en segundos).
const DURACION_CROSSFADE = 2;
// Volumen máximo de la música de fondo (1 = 100%). Si la quieres más
// bajita, cambia a 0.46 por ejemplo (como en la página de Juan Gabriel).
const VOLUMEN_BASE = 1;

// Lista de pistas disponibles.
//   archivo -> ruta real del MP3 (minúsculas y sin acentos)
//   nombre  -> título que se muestra en el botón
const pistas = [
  { archivo: 'audios/o tu o yo.mp3', nombre: 'O Tú o Yo' },
  { archivo: 'audios/el amar y el querer.mp3', nombre: 'El Amar y el Querer' },
  { archivo: 'audios/insaciable amante.mp3', nombre: 'Insaciable Amante' },
  { archivo: 'audios/monologo.mp3', nombre: 'Monólogo' },
  { archivo: 'audios/no me digas que te vas.mp3', nombre: 'No Me Digas Que Te Vas' },
  { archivo: 'audios/payaso.mp3', nombre: 'Payaso' },
  { archivo: 'audios/contigo no.mp3', nombre: 'Contigo No' },
  { archivo: 'audios/el (him).mp3', nombre: 'Él (Him)' },
  { archivo: 'audios/el triste.mp3', nombre: 'El Triste' },
  { archivo: 'audios/tu me estas volviendo loco.mp3', nombre: 'Tú Me Estás Volviendo Loco' },
  { archivo: 'audios/vamos a darnos tiempo.mp3', nombre: 'Vamos a Darnos Tiempo' },
  { archivo: 'audios/volcan.mp3', nombre: 'Volcán' },
  { archivo: 'audios/ya lo pasado, pasado.mp3', nombre: 'Ya Lo Pasado, Pasado' },
  { archivo: 'audios/cosas imposibles.mp3', nombre: 'Cosas Imposibles' },
  { archivo: 'audios/he renunciado a ti.mp3', nombre: 'He Renunciado a Ti' },
  { archivo: 'audios/lo dudo.mp3', nombre: 'Lo Dudo' },
  { archivo: 'audios/preso.mp3', nombre: 'Preso' },
  { archivo: 'audios/quemame los ojos.mp3', nombre: 'Quémame Los Ojos' },
  { archivo: 'audios/quiero perderme contigo.mp3', nombre: 'Quiero Perderme Contigo' },
  { archivo: 'audios/ya no pienso en ti.mp3', nombre: 'Ya No Pienso en Ti' }
];

// Referencias a los elementos del HTML que vamos a manipular.
const botonMusica = document.querySelector('.boton-musica');
const nombreCancion = document.querySelector('.nombre-cancion');
const textoCancion = document.querySelector('.texto-cancion');

// --- Estado del reproductor ---
// Clave: usamos UN SOLO <audio> vivo (audioFondo). Durante el crossfade se
// crea un segundo <audio> (audioFondoSiguiente); al terminar la mezcla ese
// segundo pasa a ser el principal y el anterior se limpia y descarta.
let audioFondo;                 // <audio> actual (la canción que suena ahora)
let audioFondoSiguiente = null; // <audio> de la siguiente canción (solo durante el fundido)
let crossfadeActivo = false;    // evita que se dispare más de un fundido a la vez
let intervaloCrossfade = null;  // referencia al setInterval que ajusta el volumen
let colaReproduccion = [];      // cola con los índices que faltan por sonar
let indiceActual = -1;          // índice de la canción que manda ahora

// ---------- COLA DE REPRODUCCIÓN (SIN REPETICIONES) ----------
// Usamos una COLA, que es una estructura FIFO: "el primero que entra es el
// primero que sale". Es como una fila de personas.
//
//   1. Se barajan las 20 canciones y se meten en la cola.
//   2. Para poner una canción se saca la PRIMERA de la cola (shift).
//   3. Como la canción sale de la cola al sonar, ya no puede volver a
//      aparecer hasta que la cola se vacíe; o sea, hasta que suenen las 20.
//   4. Cuando la cola queda vacía, se vuelve a llenar barajando de nuevo.
//
// Con esto se cumple la regla: una canción no se repite hasta recorrer
// todas las demás, tanto si avanza sola como si el usuario cambia de pista.

// Baraja un arreglo con el algoritmo Fisher-Yates (el clásico para mezclar
// de forma justa): recorre de atrás hacia adelante e intercambia cada
// posición con otra al azar de las anteriores.
function barajar(arreglo) {
  const copia = arreglo.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temporal = copia[i];
    copia[i] = copia[j];
    copia[j] = temporal;
  }
  return copia;
}

// Llena la cola con las 20 canciones barajadas. Si recibe "ultimaCancion",
// se asegura de que esa canción no quede la primera de la cola, para no
// repetir de inmediato la última que sonó al cerrar un ciclo.
function llenarCola(ultimaCancion) {
  const indices = pistas.map((_, i) => i); // [0, 1, 2, ... , 19]
  const barajados = barajar(indices);

  if (ultimaCancion >= 0 && barajados.length > 1 && barajados[0] === ultimaCancion) {
    const posicion = 1 + Math.floor(Math.random() * (barajados.length - 1));
    const temporal = barajados[0];
    barajados[0] = barajados[posicion];
    barajados[posicion] = temporal;
  }

  colaReproduccion = barajados;
}

// Saca la siguiente canción de la cola. Si la cola está vacía (ya sonaron
// todas), primero la vuelve a llenar.
function sacarSiguienteCancion() {
  if (colaReproduccion.length === 0) {
    llenarCola(indiceActual);
  }
  return colaReproduccion.shift(); // saca y devuelve el primero de la cola
}

// ---------- INTERFAZ DEL BOTÓN ----------
// Mantiene el botón y sus ondas sincronizados con el estado real del audio.
function actualizarBoton(reproduciendo) {
  botonMusica.classList.toggle('reproduciendo', reproduciendo);
  botonMusica.setAttribute('aria-pressed', String(reproduciendo));
  botonMusica.setAttribute(
    'aria-label',
    `${reproduciendo ? 'Pausar' : 'Reproducir'} ${pistas[indiceActual].nombre}`
  );
}

// Activa la marquesina del título cuando no cabe en el botón (misma
// lógica basada en variables CSS que ya usaba el proyecto).
function actualizarDesplazamiento() {
  nombreCancion.classList.remove('desplazar');

  requestAnimationFrame(() => {
    const distancia = nombreCancion.clientWidth - textoCancion.scrollWidth;
    if (distancia < 0) {
      nombreCancion.style.setProperty('--distancia-desplazamiento', `${distancia}px`);
      nombreCancion.style.setProperty('--duracion-desplazamiento', `${Math.max(5, Math.abs(distancia) / 10)}s`);
      nombreCancion.classList.add('desplazar');
    }
  });
}

// Refleja en el botón cuál es ahora la canción "activa".
function anunciarPistaActiva(indice) {
  indiceActual = indice;
  textoCancion.textContent = pistas[indice].nombre;
  actualizarDesplazamiento();
}

// ---------- CROSSFADE ----------
// Se dispara en cada "timeupdate" (~250 ms). Cuando quedan DURACION_CROSSFADE
// segundos o menos, inicia la mezcla ANTES de que la canción termine.
function detectarFinCancion() {
  if (crossfadeActivo || !audioFondo.duration || !Number.isFinite(audioFondo.duration)) return;
  const restante = audioFondo.duration - audioFondo.currentTime;
  if (restante <= DURACION_CROSSFADE && restante > 0) {
    iniciarCrossfade();
  }
}

// Respaldo: si la canción terminó sin que timeupdate alcanzara a disparar
// el fundido (p. ej. pestaña en segundo plano), lo arrancamos aquí.
function alTerminarCancion() {
  if (crossfadeActivo) return; // ya hay una mezcla en curso: no duplicar
  iniciarCrossfade();
}

// EL CORAZÓN DEL CROSSFADE.
// 1. Crea y reproduce la siguiente canción a volumen 0 (aquí es donde
//    empieza a DESCARGARSE el siguiente archivo).
// 2. Con un setInterval de 50 ms, baja el volumen de la actual mientras
//    sube el de la nueva, hasta completar los 2 s.
// 3. Al terminar, libera la canción anterior y el segundo <audio> pasa a
//    ser el principal.
function iniciarCrossfade() {
  if (crossfadeActivo) return;

  const siguienteIndice = sacarSiguienteCancion();
  anunciarPistaActiva(siguienteIndice); // el botón muestra ya la canción nueva

  // Nuevo <audio> en silencio (volumen 0): no se oye hasta que el fundido
  // lo vaya subiendo, pero durante esos 2 s el navegador lo está buffereando.
  audioFondoSiguiente = new Audio(pistas[siguienteIndice].archivo);
  audioFondoSiguiente.volume = 0;
  audioFondoSiguiente.preload = 'auto';
  audioFondoSiguiente.play().catch(() => {});

  crossfadeActivo = true;

  // pasos = DURACION_CROSSFADE * 20 porque el intervalo corre cada 50 ms
  // (2 s × 20 pasos/segundo = 40 pasos totales).
  const pasos = DURACION_CROSSFADE * 20;
  let pasoActual = 0;

  intervaloCrossfade = window.setInterval(() => {
    pasoActual += 1;
    const progreso = Math.min(pasoActual / pasos, 1); // 0 -> 1 durante la mezcla

    audioFondo.volume = VOLUMEN_BASE * (1 - progreso); // la actual baja
    audioFondoSiguiente.volume = VOLUMEN_BASE * progreso; // la nueva sube

    if (pasoActual >= pasos) {
      window.clearInterval(intervaloCrossfade);
      intervaloCrossfade = null;

      // 1) Liberar la canción anterior de la memoria del navegador.
      audioFondo.pause();
      audioFondo.removeEventListener('ended', alTerminarCancion);
      audioFondo.removeEventListener('timeupdate', detectarFinCancion);
      audioFondo.src = '';
      audioFondo.load(); // suelta el archivo descargado

      // 2) El segundo <audio> pasa a ser el principal y queda listo.
      audioFondo = audioFondoSiguiente;
      audioFondoSiguiente = null;
      audioFondo.volume = VOLUMEN_BASE;
      audioFondo.addEventListener('ended', alTerminarCancion);
      audioFondo.addEventListener('timeupdate', detectarFinCancion);
      crossfadeActivo = false;

      actualizarBoton(true);
    }
  }, 50);
}

// Si el usuario pausa a mitad de un fundido, lo cancela de forma limpia:
// restaura el volumen, descarta el <audio> nuevo y vuelve a la normalidad.
function cancelarCrossfade() {
  if (!crossfadeActivo) return;

  window.clearInterval(intervaloCrossfade);
  intervaloCrossfade = null;
  audioFondo.volume = VOLUMEN_BASE;

  if (audioFondoSiguiente) {
    audioFondoSiguiente.pause();
    audioFondoSiguiente.src = '';
    audioFondoSiguiente = null;
  }

  crossfadeActivo = false;
}

// ---------- REPRODUCIR / PAUSAR ----------
// Intenta iniciar la reproducción. Se llama al cargar la página y con el
// primer gesto del usuario (los navegadores bloquean el autoplay sonoro).
async function intentarReproducir() {
  if (!audioFondo || pistas.length === 0 || !audioFondo.paused) return;

  try {
    await audioFondo.play();
    actualizarBoton(true);
  } catch (error) {
    // Autoplay sonoro bloqueado: la música empezará con el primer clic.
  }
}

// ---------- ARRANQUE ----------
// Se descarga SOLO la primera canción de la cola (el resto no se toca).
indiceActual = sacarSiguienteCancion();
anunciarPistaActiva(indiceActual);
audioFondo = new Audio(pistas[indiceActual].archivo);
audioFondo.volume = VOLUMEN_BASE;
audioFondo.preload = 'auto';
audioFondo.autoplay = true;
audioFondo.playsInline = true;
audioFondo.load(); // <-- aquí se descarga la primera canción
audioFondo.addEventListener('ended', alTerminarCancion);
audioFondo.addEventListener('timeupdate', detectarFinCancion);

// ---------- EVENTOS GLOBALES ----------
// Autoplay al terminar de cargar la página (puede que el navegador lo
// bloquee hasta que haya una interacción).
intentarReproducir();
window.addEventListener('load', intentarReproducir);
window.addEventListener('pointerdown', (evento) => {
  // Ignoramos los clics dentro del botón de música: este control ya tiene
  // su propia lógica (reproducir / pausar / siguiente).
  if (!evento.target.closest('.boton-musica')) intentarReproducir();
}, { once: true });

// Clic en el botón: si se tocó el icono ▶| se salta a la siguiente canción;
// cualquier otra parte del botón pausa / reanuda.
botonMusica.addEventListener('click', async (evento) => {
  if (!audioFondo) return;

  // El ▶| está integrado DENTRO de la cápsula, así que distinguimos por
  // proximidad: un clic en él (o en su divisor) avanza la pista.
  if (evento.target.closest('.boton-siguiente')) {
    avanzarCancion();
    return;
  }

  if (audioFondo.paused) {
    await intentarReproducir(); // estaba pausado -> reproducimos
  } else {
    cancelarCrossfade(); // si había un fundido en marcha, lo cancelamos
    audioFondo.pause();  // estaba sonando -> pausamos
    actualizarBoton(false);
  }
});

// ---------- SALTAR A LA SIGUIENTE CANCIÓN (icono ▶| de la cápsula) ----------
// La misma filosofía de eficiencia que el crossfade: al cambar de pista se
// suelta la fuente anterior y el navegador solo descarga la siguiente.
function avanzarCancion() {
  if (!audioFondo) return;

  // Cualquier fundido a medias se cancela y el sonido actual se corta.
  audioFondo.pause();
  cancelarCrossfade();

  const siguienteIndice = sacarSiguienteCancion();
  anunciarPistaActiva(siguienteIndice); // el título del botón se actualiza

  // Al asignar un src nuevo, el navegador descarta la pista vieja y
  // empieza a cargar únicamente la siguiente (nada de buffering doble).
  audioFondo.src = pistas[siguienteIndice].archivo;
  audioFondo.volume = VOLUMEN_BASE;
  audioFondo.currentTime = 0;
  audioFondo.load();

  audioFondo.play()
    .then(() => actualizarBoton(true))
    .catch(() => actualizarBoton(false)); // autoplay bloqueado: queda pausado
}
