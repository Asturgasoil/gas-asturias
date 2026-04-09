const { createClient } = require('@supabase/supabase-js');

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

async function fetchWithRetry(url, retries = 3, interval = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.log(`⚠️ Intento ${i + 1} fallido: ${err.message}. Reintentando en ${interval/1000}s...`);
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, interval));
    }
  }
}

async function run() {
  const batchTimestamp = new Date().toISOString(); 
  console.log(`--- Iniciando Scraper Asturias (${batchTimestamp}) ---`);

  try {
    const data = await fetchWithRetry(API_URL);
    
    if (!data || !data.ListaEESSPrecio) {
      throw new Error("La respuesta del API no contiene 'ListaEESSPrecio'");
    }

    const stations = data.ListaEESSPrecio;
    console.log(`Leídas ${stations.length} estaciones de la provincia 33.`);

    if (stations.length > 0) {
      console.log("Muestra de claves disponibles en la primera estación:", Object.keys(stations[0]).join(', '));
    }

    const getPrice = (station, type) => {
      const keys = {
        '95': ['Precio Gasolina 95 E5', 'Precio Gasoleo 95 E5', '95 E5'],
        'diesel': ['Precio Gasóleo A', 'Precio Gasoleo A', 'Precio GasóleoA', 'Precio GasoleoA', 'Gasóleo A']
      };
      for (const key of keys[type]) {
        if (station[key]) return parseFloat(station[key].replace(',', '.'));
      }
      return null;
    };

    const filtered = stations
      .map(s => {
        const zone = getZone(s.Municipio);
        if (!zone) return null;

        const p95 = getPrice(s, '95');
        const pDiesel = getPrice(s, 'diesel');

        if (!p95 && !pDiesel) return null;

        return {
          station_name: s.Rótulo,
          address: s.Dirección,
          municipality: s.Municipio,
          zone: zone,
          price_95: p95,
          price_diesel: pDiesel,
          created_at: batchTimestamp 
        };
      })
      .filter(s => s !== null);

    if (filtered.length === 0) {
      throw new Error("No se han encontrado datos válidos después de filtrar por zonas y precios. Es posible que el API haya devuelto datos incompletos.");
    }

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
    console.log("✅ Datos actualizados correctamente en Supabase.");

  } catch (err) {
    console.error("❌ Fallo crítico en el Scraper:", err.message || err);
    process.exit(1);
  }
}

run();
