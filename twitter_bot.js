const { createClient } = require('@supabase/supabase-js');
const { TwitterApi } = require('twitter-api-v2');

// --- CONFIGURACIÓN ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const clientID = process.env.X_CLIENT_ID;
const clientSecret = process.env.X_CLIENT_SECRET;

// --- DICCIONARIO HUMANIZADO (Castellano con pinceladas asturianas) ---
const HOLIDAYS = {
  '01-01': '¡Feliz Año Nuevo! Que este año no nos falte salud ni gasolina barata. 🥂⛽',
  '09-08': '¡Puxa Asturies! Hoy celebramos la Santina y que bajen los precios por fin. 💙💛',
  '12-25': '¡Feliz Navidad! Que Papá Noel traiga un depósito lleno para todos. 🎅⛽'
};

const TEMPLATES = {
  morning: [
    "¡Buenos días! Con este orbayu no dan ganas de salir, pero con estos precios igual sí. ☔️⛽",
    "¡Puxa! He visto unos precios hoy que ni los fichajes de este año. ¡Aprovechad! ⚽️",
    "¡A esgaya! Mirad qué ofertones tenemos hoy en las gasolineras asturianas. 👇"
  ],
  midday: [
    "¿Hora de comer? Antes pasa por aquí a ahorrar unos eurillos en el depósito. 🍴",
    "Para los que estáis trabajando: aquí tenéis dónde ahorrar para la sidrina de después. 🍏",
    "¡Ojo! Esta es la gasolinera más barata para repostar antes de volver al tajo. 👷‍♂️"
  ],
  evening: [
    "¡Ya de vuelta a casa! No os olvidéis de pasar por aquí para no llegar en reserva. 🏡",
    "Después de todo el día, un descanso para el bolsillo no viene mal. Mirad esto: 👇",
    "¡Hartos de los precios altos! Por suerte, aquí tenemos lo mejor de hoy. 📉"
  ]
};

const WEB_URL = 'https://asturgasoil.github.io/gas-asturias/';
const HASHTAGS = '\n\n#Asturias #Ahorro #AsturGasoil #PuxaAsturies';

async function run() {
  const mode = process.argv[2] || 'morning';
  console.log(`--- Iniciando Bot de X (${mode}) vía OAuth 2.0 ---`);
  
  try {
    // 1. Obtener refresh token de Supabase
    const { data: dbData, error: dbError } = await supabase
      .from('twitter_tokens')
      .select('token_value')
      .eq('token_name', 'refresh_token')
      .single();

    if (dbError || !dbData) throw new Error('No hay refresh_token en Supabase.');

    // 2. Refrescar el token con X
    const client = new TwitterApi({ clientId: clientID, clientSecret: clientSecret });
    const { client: refreshedClient, refreshToken: newRefreshToken } = await client.refreshOAuth2Token(dbData.token_value);

    // 3. Guardar el nuevo refresh token
    console.log('Actualizando refresh_token en Supabase...');
    await supabase.from('twitter_tokens').update({ 
      token_value: newRefreshToken, 
      updated_at: new Date().toISOString() 
    }).eq('token_name', 'refresh_token');

    // 4. Obtener precios de la base de datos
    const { data: prices } = await supabase.from('prices').select('*').order('created_at', { ascending: false }).limit(300);
    if (!prices || prices.length === 0) return;

    const lastDate = prices[0].created_at;
    const latestBatch = prices.filter(p => p.created_at === lastDate);
    
    // Filtros para encontrar el más barato
    const chollo95 = [...latestBatch].filter(p => p.price_95).sort((a,b) => a.price_95 - b.price_95)[0];
    const cholloDiesel = [...latestBatch].filter(p => p.price_diesel).sort((a,b) => a.price_diesel - b.price_diesel)[0];

    const today = new Date().toISOString().slice(5, 10);
    const holidayGreet = HOLIDAYS[today] || '';
    const templates = TEMPLATES[mode] || TEMPLATES.morning;
    const template = templates[Math.floor(Math.random() * templates.length)];

    let tweetText = `${holidayGreet ? holidayGreet + '\n\n' : ''}${template}\n\n`;
    
    // Texto del Tweet con Gasolina 95 y Gasoil
    if (chollo95) tweetText += `🟢 Gasolina 95: ${chollo95.price_95.toFixed(3)}€ en ${chollo95.station_name} (${chollo95.municipality})\n`;
    if (cholloDiesel) tweetText += `🟡 Gasoil: ${cholloDiesel.price_diesel.toFixed(3)}€ en ${cholloDiesel.station_name} (${cholloDiesel.municipality})\n`;
    
    tweetText += `\n📍 Web: ${WEB_URL}${HASHTAGS}`;

    // 5. Publicar el Tweet
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
