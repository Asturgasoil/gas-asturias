const { createClient } = require('@supabase/supabase-js');
const { TwitterApi } = require('twitter-api-v2');

// --- CONFIGURACIÓN ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const clientID = process.env.X_CLIENT_ID;
const clientSecret = process.env.X_CLIENT_SECRET;

// --- DICCIONARIO HUMANIZADO (Más Castellano con toques asturianos) ---
const HOLIDAYS = {
  '01-01': '¡Feliz Año Nuevo! Que este año no nos falte salud ni gasolina barata. 🥂⛽',
  '09-08': '¡Puxa Asturies! Hoy celebramos la Santina y que bajen los precios por fin. 💙💛',
  '12-25': '¡Feliz Navidad! Que Papá Noel traiga un depósito lleno para todos. 🎅⛽'
};

const POOLS = {
  morning: {
    intros: ["¡Buenos días!", "Empezamos el día con noticias,", "¡Hola a todos!", "Damos comienzo a la jornada,", "Para empezar con buen pie,", "¡Arrancamos motores!", "Un nuevo día,", "¡Buenos días Asturias!", "Comenzamos la mañana,", "Antes de tu primer café,", "¡Hola conductores!", "Recibimos el día,", "Para los que madrugan,", "En marcha,", "Buen día,"],
    bodies: ["hemos localizado las opciones más baratas.", "aquí tienes la comparativa de precios.", "hemos detectado bajadas interesantes.", "estos son los precios récord de hoy.", "mira dónde están los ahorros ahora.", "te traemos la lista de estaciones líderes.", "esta es la situación del carburante.", "hemos analizado todas las estaciones.", "aquí tienes los datos de primera hora.", "así están los precios en la región.", "te mostramos las gasolineras ganadoras.", "estos son los chollos del momento.", "hemos filtrado el ahorro para ti.", "esta mañana la cosa está así:", "mira el panorama del combustible:"],
    hooks: ["¡Ahorra en cada litro!", "No pagues ni un céntimo de más.", "Tu bolsillo te lo agradecerá.", "Planifica tu parada y ahorra.", "El ahorro real empieza aquí.", "No repostes sin mirar esto.", "Aprovecha los mejores precios.", "Encuentra tu estación ideal.", "Asegura el mejor precio hoy.", "Haz que tu depósito cunda más.", "El ahorro es para los que saben.", "Mira la lista completa aquí:", "Tu guía diaria del ahorro:", "Ahorra tiempo y dinero:", "La mejor selección de hoy:"]
  },
  midday: {
    intros: ["¿Haciendo un descanso?", "¿Pausa para comer?", "¡Hola de nuevo!", "¿Cómo va ese mediodía?", "A mitad de jornada,", "Actualización rápida:", "¡Ojo al dato!", "Para los que están en ruta,", "En pleno mediodía,", "¡Buenas tardes!", "¿Vas a salir ahora?", "Un minuto de tu tiempo:", "A estas horas,", "¡Atención al ahorro!", "Novedades de mediodía:"],
    bodies: ["hemos encontrado cambios en los precios.", "¿sabías que puedes ahorrar hasta un 10%?", "hay una zona con precios imbatibles.", "no todos los precios son iguales ahora.", "hemos detectado nuevas oportunidades.", "varias estaciones han bajado precios.", "el ranking ha cambiado hace un momento.", "¿has visto la última actualización?", "tenemos datos frescos para tu bolsillo.", "el ahorro no descansa hoy.", "algunas estaciones están rompiendo stock.", "mira qué zona es la más barata ahora.", "te sorprenderá lo que hemos visto.", "el mapa del ahorro sigue moviéndose.", "hemos cazado nuevas ofertas."],
    hooks: ["Míralo todo en nuestra web.", "Entra y localiza tu ahorro.", "No te pierdas los detalles.", "Consulta el mapa interactivo.", "Haz clic y ahorra ahora.", "Toda la info en un vistazo.", "Descubre las gasolineras VIP.", "El ahorro no espera, ¡entra!", "Mira si tu zona es la ganadora.", "No pagues el precio de siempre.", "Toda Asturias en un clic.", "Tu gasolinera ideal te espera.", "Sigue el ahorro en directo.", "Entra y compara tú mismo.", "La web indispensable hoy:"]
  },
  evening: {
    intros: ["¿De vuelta a casa?", "Terminando el día,", "¡Buenas tardes-noches!", "¿Ya has terminado?", "Antes de aparcar,", "Para cerrar bien el día,", "¡Hola conductores!", "En este atardecer,", "Mañana será otro día,", "Ya de regreso,", "¡No te vayas sin mirar esto!", "Última hora:", "Al final de la jornada,", "Para los rezagados,", "¡Atención al ahorro final!"],
    bodies: ["mañana los precios podrían subir.", "revisa dónde repostar antes de mañana.", "hay chollos que no durarán mucho.", "hemos visto precios muy atractivos.", "prepárate para el viaje de mañana.", "el ahorro de hoy sigue disponible.", "muchos ya están ahorrando con esto.", "haz que tu regreso sea más barato.", "no dejes pasar esta oportunidad.", "el panorama para mañana está listo.", "todavía quedan opciones económicas.", "mira cómo queda el ranking final.", "hemos analizado la tendencia de hoy.", "los datos de hoy son sorprendentes.", "varias zonas siguen en precios bajos."],
    hooks: ["Consulta la web y ahorra.", "Planifica tu parada de mañana.", "No esperes a que suban.", "Toda la información aquí.", "Entra y decide dónde ir.", "Ahorra antes de llegar a casa.", "El ahorro nunca duerme.", "Mira el resumen del día.", "Tu bolsillo necesita esto.", "Únete a los que ahorran hoy.", "Haz clic y mira el mapa.", "La guía definitiva de hoy.", "Mañana más, pero hoy esto:", "No te vayas con la duda.", "El mejor cierre para tu día:"]
  }
};

function generateTweet(mode) {
  const pool = POOLS[mode] || POOLS.morning;
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  // Semilla determinista basada en la fecha
  const seed = (day + (month * 31) + (year - 2024));
  
  const intro = pool.intros[seed % pool.intros.length];
  const body = pool.bodies[(seed * 7) % pool.bodies.length];
  const hook = pool.hooks[(seed * 13) % pool.hooks.length];
  
  return `${intro} ${body} ${hook}`;
}

const WEB_URL = 'https://asturgasoil.github.io/gas-asturias/';
const HASHTAGS = '\n\n#Asturias #Ahorro #Gasolina #Diesel #AsturGasoil';

async function run() {
  const mode = process.argv[2] || 'morning';
  console.log(`--- Iniciando Bot de X (${mode}) vía OAuth 2.0 ---`);
  
  try {
    const { data: dbData, error: dbError } = await supabase
      .from('twitter_tokens')
      .select('token_value')
      .eq('token_name', 'refresh_token')
      .single();

    if (dbError || !dbData) throw new Error('No hay refresh_token en Supabase.');

    const client = new TwitterApi({ clientId: clientID, clientSecret: clientSecret });
    const { client: refreshedClient, refreshToken: newRefreshToken } = await client.refreshOAuth2Token(dbData.token_value);

    console.log('Actualizando refresh_token en Supabase...');
    await supabase.from('twitter_tokens').update({ 
      token_value: newRefreshToken, 
      updated_at: new Date().toISOString() 
    }).eq('token_name', 'refresh_token');

    const { data: prices } = await supabase.from('prices').select('*').order('created_at', { ascending: false }).limit(300);
    if (!prices || prices.length === 0) return;

    const lastDate = prices[0].created_at;
    const latestBatch = prices.filter(p => p.created_at === lastDate);
    
    const dataDate = new Date(lastDate);
    console.log(`Usando datos del batch: ${lastDate} (${dataDate.toLocaleString('es-ES')})`);

    const chollo95 = [...latestBatch].filter(p => p.price_95).sort((a,b) => a.price_95 - b.price_95)[0];
    const cholloDiesel = [...latestBatch].filter(p => p.price_diesel).sort((a,b) => a.price_diesel - b.price_diesel)[0];

    let tweetText = generateTweet(mode) + "\n\n";
    
    // Solo mostramos precios en el modo "morning"
    if (mode === 'morning') {
      if (chollo95) tweetText += `🟢 Gasolina 95: ${chollo95.price_95.toFixed(3)}€ en ${chollo95.station_name} (${chollo95.municipality})\n`;
      if (cholloDiesel) tweetText += `🟡 Diesel: ${cholloDiesel.price_diesel.toFixed(3)}€ en ${cholloDiesel.station_name} (${cholloDiesel.municipality})\n`;
    } 
    
    tweetText += `\n📍 Web: ${WEB_URL}${HASHTAGS}`;

    const { data: createdTweet } = await refreshedClient.v2.tweet(tweetText);
    console.log(`✅ ¡Tweet publicado! ID: ${createdTweet.id}`);

  } catch (err) {
    if (err.data) {
      console.error('❌ ERROR TWITTER:', JSON.stringify(err.data, null, 2));
    } else {
      console.error('❌ Error fatal:', err.message || err);
    }
    process.exit(1);
  }
}

run();
