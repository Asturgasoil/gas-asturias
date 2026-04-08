const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API_URL = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/33';

// Robust Zone Mapping
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
  console.log('--- Iniciando Scraper AsturGasoil ---');
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    const stations = data.ListaEESSPrecio;

    const filtered = stations
      .map(s => {
        const zone = getZone(s.Municipio);
        if (!zone) return null;

        const p95 = s['Precio Gasolina 95 E5'];
        const pDiesel = s['Precio Gasoleo A'];

        return {
          station_name: s['Rótulo'],
          address: s['Dirección'],
          municipality: s.Municipio,
          zone: zone,
          price_95: p95 ? parseFloat(p95.replace(',', '.')) : null,
          price_diesel: pDiesel ? parseFloat(pDiesel.replace(',', '.')) : null,
          created_at: new Date().toISOString()
        };
      })
      .filter(s => s !== null && (s.price_95 !== null || s.price_diesel !== null));

    if (filtered.length === 0) {
      console.log('No se encontraron datos para las zonas configuradas.');
      return;
    }

    const { error } = await supabase.from('prices').insert(filtered);
    if (error) throw error;
    
    console.log(`✅ ¡Éxito! Se han guardado ${filtered.length} registros en Supabase.`);

  } catch (err) {
    console.error('❌ Error en el scraper:', err);
    process.exit(1);
  }
}

run();
