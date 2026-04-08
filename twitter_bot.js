const { createClient } = require('@supabase/supabase-js');
const { TwitterApi } = require('twitter-api-v2');

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const twitterClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

// --- HUMANIZED DICTIONARY ---

const HOLIDAYS = {
  '01-01': '¡Feliz Año Nuevo, Asturies! ❤️ A empezar el año ahorrando.',
  '01-06': '¡Feliz Día de Reyes! 👑 Espero que os hayan traído mucha gasolina barata.',
  '05-01': '¡Feliz Día del Trabajador! 🛠️ Hoy se descansa, pero el coche sigue necesitando beber.',
  '08-15': '¡Feliz día de la Asunción! ⛪️ Mucha precaución en las carreteras asturianas hoy.',
  '09-08': '¡Puxa Asturies! 💙💛 ¡Feliz Día de nuestra tierrina! ¡A por el bollu y la sidra!',
  '12-24': '¡Nochebuena! 🎄 ¡A cenar rico y a no gastar de más en el viaje!',
  '12-25': '¡Feliz Navidad! 🎅🎁 Un regalo en forma de precios bajos no estaría mal, ¿eh?',
  '12-31': '¡Último día del año! 🍇 ¡Llenad el depósito antes de las uvas!'
};

const TOPICAL_HOOKS = {
  morning: [
    "¡Oye! Fíjate qué precios... Casi sale más barato el gasoil que un café en el centro. ☕️💸",
    "¡Buenos días! Con este orbayu no dan ganas de salir, pero con estos precios igual sí. ☔️⛽️",
    "¡Puxa! He visto unos precios hoy que ni en el Chiringuito de Jugones se ven tales fichajes. ⚽️",
    "¿Has visto cómo está la cesta de la compra? Al menos hoy la gasolina nos da un respiro. 🛒💰",
    "¡Fae un sol de caralla! ☀️ Perfecto para dar una vuelta, sobre todo viendo estos precios:"
  ],
  midday: [
    "¿Todavía sin comer? 🍴 Antes de hincarle el diente al cachopo, mira dónde repostar.",
    "Buscando el ahorro como quien busca una plaza de parking en Gijón un sábado. 🚗💨",
    "¡Madre mía la inflación! 📈 Menos mal que he encontrado este chollo para hoy:",
    "¿Unas sidras luego? 🍻 Si ahorras esto en gasolina, ¡la primera ronda la pagas tú!",
    "Dicen que el dinero no da la felicidad, pero ahorrar 10€ al llenar el depósito se le parece mucho. 😏"
  ],
  evening: [
    "🚗 ¿Vuelta a casa? Que no se te olvide pasar por aquí, que mañana igual es tarde.",
    "Terminando el día... ¡y con la cartera menos vacía de lo esperado! Mira esto: 💙💛",
    "¿Has trabajado mucho hoy? Pues no regales tu sueldo en la gasolinera. 🛑💸",
    "¡Vaya día! Antes de llegar a casa y ponerte el pijama, aprovecha este precio: 🏠⛽️",
    "Mañana será otro día, pero este precio es de AHORA mismo. ¡No lo dejes escapar! 🏃‍♂️💨"
  ]
};

const WEB_URL = 'https://asturgasoil.github.io/gas-asturias/';
const HASHTAGS = '\n\n#Asturias #Gasoil #Gasolina #Ahorro #AsturGasoil #PuxaAsturies';

async function run() {
  const mode = process.argv[2] || 'morning';
  const today = new Date();
  const dateKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  console.log(`--- Iniciando Bot de X (${mode}) ---`);
  
  try {
    const { data: prices, error } = await supabase
      .from('prices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) throw error;
    if (!prices || prices.length === 0) return;

    const lastBatchDate = prices[0].created_at;
    const latestBatch = prices.filter(p => p.created_at === lastBatchDate);

    const chollo95 = [...latestBatch].filter(p => p.price_95).sort((a,b) => a.price_95 - b.price_95)[0];
    const cholloDiesel = [...latestBatch].filter(p => p.price_diesel).sort((a,b) => a.price_diesel - b.price_diesel)[0];

    const p95Value = chollo95 ? chollo95.price_95.toFixed(3) : '---';
    const pDieselValue = cholloDiesel ? cholloDiesel.price_diesel.toFixed(3) : '---';

    // 1. Check for Holiday greeting
    let tweetGreeting = '';
    if (HOLIDAYS[dateKey]) {
      tweetGreeting = `${HOLIDAYS[dateKey]}\n\n`;
    }

    // 2. Pick a random humorous hook
    const hooks = TOPICAL_HOOKS[mode] || TOPICAL_HOOKS.morning;
    const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
    
    // 3. Compose Tweet
    let tweetText = tweetGreeting;
    tweetText += `${randomHook}\n\n`;
    
    if (chollo95) {
      tweetText += `🟢 95: ${p95Value}€ en ${chollo95.station_name} (${chollo95.municipality})\n`;
    }
    if (cholloDiesel) {
      tweetText += `🟡 Diésel: ${pDieselValue}€ en ${cholloDiesel.station_name} (${cholloDiesel.municipality})\n`;
    }

    tweetText += `\n📍 Mira el resto de zonas en la web:\n${WEB_URL}${HASHTAGS}`;

    console.log('--- TWEET GENERADO ---');
    console.log(tweetText);
    
    const { data: createdTweet } = await twitterClient.v2.tweet(tweetText);
    console.log(`✅ Tweet publicado (${mode}) ID: ${createdTweet.id}`);

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
