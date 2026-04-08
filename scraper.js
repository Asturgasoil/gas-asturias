const { createClient } = require('@supabase/supabase-js');
const { fetch } = require('undici'); // Usamos undici que es más moderno para Node 18+

// Environment Variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const API_URL = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/33';

const ZONES = {
  'OVIEDO': ['OVIEDO'],
  'GIJON': ['GIJÓN', 'GIJON'],
  'AVILES': ['AVILÉS', 'AVILES', 'GOZÓN', 'GOZON', 'CASTRILLÓN', 'CASTRILLON', 'CORVERA DE ASTURIAS'],
  'CUENCAS': ['MIERES', 'LANGREO', 'SAN MARTÍN DEL REY AURELIO', 'SAN MARTIN DEL REY AURELIO', 'LAVIANA', 'LENA', 'ALLER'],
  'ORIENTAL': ['LLANES', 'RIBADESELLA', 'VILLAVICIOSA', 'CANGAS DE ONÍS', 'CANGAS DE ONIS'],
  'OCCIDENTAL': ['NAVIA', 'VALDÉS', 'VALDES', 'CASTROPOL']
};

function getZone(municipio) {
  for (const [zone, muns] of Object.entries(ZONES)) {
    if (muns.includes(municipio.toUpperCase().trim())) {
      return zone;
    }
  }
  return null;
}

async function run() {
  // CLAVE: Generamos UNA SOLA HORA para todo el lote
  const batchTimestamp = new Date().toISOString(); 
  console.log(`--- Iniciando Scraper Asturias (${batchTimestamp}) ---`);

  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    const stations = data.ListaEESSPrecio;

    const filtered = stations
      .map(s => {
        const zone = getZone(s.Municipio);
        if (!zone) return null;

        const p95 = s['Precio Gasolina 95 E5'];
        const pDiesel = s['Precio Gasóleo A'];

        return {
          station_name: s.Rótulo,
          address: s.Dirección,
          municipality: s.Municipio,
          zone: zone,
          price_95: p95 ? parseFloat(p95.replace(',', '.')) : null,
          price_diesel: pDiesel ? parseFloat(pDiesel.replace(',', '.')) : null,
          created_at: batchTimestamp // Usamos la misma hora para todos
        };
      })
      .filter(s => s !== null && (s.price_95 !== null || s.price_diesel !== null));

    if (filtered.length === 0) {
      console.log("No se han encontrado datos para las zonas configuradas.");
      return;
    }

    // Buscamos los más baratos de toda Asturias de este lote
    const cheapest95 = [...filtered].filter(s => s.price_95).sort((a,b) => a.price_95 - b.price_95)[0];
    const cheapestDiesel = [...filtered].filter(s => s.price_diesel).sort((a,b) => a.price_diesel - b.price_diesel)[0];

    const finalData = filtered.map(s => ({
      ...s,
      is_cheapest_asturias_95: cheapest95 && s.station_name === cheapest95.station_name && s.address === cheapest95.address,
      is_cheapest_asturias_diesel: cheapestDiesel && s.station_name === cheapestDiesel.station_name && s.address === cheapestDiesel.address
    }));

    console.log(`Subiendo ${finalData.length} registros a Supabase...`);
    const { error } = await supabase.from('prices').insert(finalData);

    if (error) throw error;
    console.log("✅ Datos actualizados correctamente.");

  } catch (err) {
    console.error("❌ Fallo en el Scraper:", err);
    process.exit(1);
  }
}

run();
