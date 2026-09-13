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
  { archivo: 'audios/te quiero tal como eres.mp3', nombre: 'Te Quiero Tal Como Eres' },
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
let colaReproduccion = [];      // cola aleatoria de índices
let indiceActual = -1;          // índice de la canción que manda ahora

// ---------- COLA ALEATORIA ----------
// Mezcla Fisher-Yates: desordena el arreglo al azar, sin sesgos.
function mezclarFisherYates(arr) {
  const shuffled = arr.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

// Devuelve true si dos canciones vecinas de la lista original (|a-b|===1)
// quedaron contiguas en la cola. Sirve para dispersar las canciones del
// setlist y que la mezcla no suene "agrupada".
function tieneVecinosAdyacentes(arr) {
  for (let k = 0; k < arr.length - 1; k++) {
    if (Math.abs(arr[k] - arr[k + 1]) === 1) {
      return true;
    }
  }
  return false;
}

// Genera una cola aleatoria de índices (0..n-1), re-mezclando con límite
// de intentos para evitar vecinos de la playlist, y excluye que la primera
// sea la misma canción que acaba de sonar.
function generarColaAleatoria(excluirUltimo) {
  const indices = pistas.map((_, i) => i);
  let shuffled = mezclarFisherYates(indices);

  let intentos = 0;
  while (tieneVecinosAdyacentes(shuffled) && intentos < 30) {
    shuffled = mezclarFisherYates(indices);
    intentos += 1;
  }

  if (excluirUltimo && shuffled[0] === indiceActual && shuffled.length > 1) {
    const temp = shuffled[0];
    shuffled[0] = shuffled[shuffled.length - 1];
    shuffled[shuffled.length - 1] = temp;
  }

  return shuffled;
}

// Saca el siguiente índice de la cola; si la cola se agotó, la regenera.
function seleccionarSiguienteCancion() {
  if (colaReproduccion.length === 0) {
    colaReproduccion = generarColaAleatoria(true);
  }
  return colaReproduccion.shift();
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

  const siguienteIndice = seleccionarSiguienteCancion();
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
indiceActual = seleccionarSiguienteCancion();
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

  const siguienteIndice = seleccionarSiguienteCancion();
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
