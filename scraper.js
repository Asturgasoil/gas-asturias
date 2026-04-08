const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Environment Variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API_URL = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/33';

const ZONES = {
  'OVIEDO': ['OVIEDO'],
  'GIJON': ['GIJÓN'],
  'AVILES': ['AVILÉS', 'GOZÓN', 'CASTRILLÓN', 'CORVERA DE ASTURIAS'],
  'CUENCAS': ['MIERES', 'LANGREO', 'SAN MARTÍN DEL REY AURELIO', 'LAVIANA', 'LENA', 'ALLER'],
  'ORIENTAL': ['LLANES', 'RIBADESELLA', 'VILLAVICIOSA', 'CANGAS DE ONÍS'],
  'OCCIDENTAL': ['NAVIA', 'VALDÉS', 'CASTROPOL']
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
  console.log("Fetching gas prices for Asturias...");
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    const stations = data.ListaEESSPrecio;

    const filtered = stations
      .map(s => {
        const zone = getZone(s.Municipio);
        if (!zone) return null;

        // SAFE PARSING OF PRICES (Note: Use "Gasoleo" without accent for the API key)
        const p95 = s['Precio Gasolina 95 E5'];
        const pDiesel = s['Precio Gasoleo A'];

        return {
          station_name: s.Rótulo,
          address: s.Dirección,
          municipality: s.Municipio,
          zone: zone,
          price_95: p95 ? parseFloat(p95.replace(',', '.')) : null,
          price_diesel: pDiesel ? parseFloat(pDiesel.replace(',', '.')) : null,
          created_at: new Date().toISOString()
        };
      })
      .filter(s => s !== null && (s.price_95 !== null || s.price_diesel !== null));

    if (filtered.length === 0) {
      console.log("No stations found for the specified zones.");
      return;
    }

    const cheapest95 = [...filtered].filter(s => s.price_95).sort((a,b) => a.price_95 - b.price_95)[0];
    const cheapestDiesel = [...filtered].filter(s => s.price_diesel).sort((a,b) => a.price_diesel - b.price_diesel)[0];

    const finalData = filtered.map(s => ({
      ...s,
      is_cheapest_asturias_95: cheapest95 && s.station_name === cheapest95.station_name && s.address === cheapest95.address,
      is_cheapest_asturias_diesel: cheapestDiesel && s.station_name === cheapestDiesel.station_name && s.address === cheapestDiesel.address
    }));

    console.log(`Pushing ${finalData.length} records to Supabase...`);
    const { error } = await supabase.from('prices').insert(finalData);

    if (error) {
        console.error("Error inserting data into Supabase:", error);
        throw error;
    }

    console.log("Done! Data synchronized successfully.");
  } catch (err) {
    console.error("Run failed:", err);
    process.exit(1);
  }
}

run();
