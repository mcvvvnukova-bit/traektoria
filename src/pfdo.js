const {
  PFDO_API_BASE,
  PFDO_OPERATOR_ID,
  getProgramUrl,
  getOperatorId,
} = require("./pfdo-config");
const PFDO_MAX_PAGES = Number(process.env.PFDO_MAX_PAGES || 3);
const PFDO_REQUEST_TIMEOUT_MS = Number(process.env.PFDO_REQUEST_TIMEOUT_MS || 30000);
const PFDO_REQUEST_RETRIES = Number(process.env.PFDO_REQUEST_RETRIES || 4);

const REQUEST_HEADERS = {
  "user-agent": "Mozilla/5.0 TelegramBotMVP/1.0",
  accept: "application/json",
};

const municipalitiesCache = {
  value: null,
  loadedAt: 0,
};

async function getMunicipalities() {
  if (municipalitiesCache.value && Date.now() - municipalitiesCache.loadedAt < 12 * 60 * 60 * 1000) {
    return municipalitiesCache.value;
  }

  const response = await fetchJson(`/main-page/muns/${PFDO_OPERATOR_ID}`);
  municipalitiesCache.value = response.data || [];
  municipalitiesCache.loadedAt = Date.now();
  return municipalitiesCache.value;
}

async function getRegions() {
  const response = await fetchJson("/main-page/regions");
  return response.data || [];
}

async function getOperatorInfo(operatorId = PFDO_OPERATOR_ID) {
  const response = await fetchJson(`/main-page/operator-info/${operatorId}`);
  return response.data || null;
}

async function getMunicipalityInfo(municipalityId) {
  const response = await fetchJson(`/main-page/info-mun/${municipalityId}`);
  return response.data || null;
}

async function getMunicipalityUsefulContacts(operatorId = PFDO_OPERATOR_ID) {
  const response = await fetchJson(`/public/municipality-useful-contact?search[operator_id]=${operatorId}`);
  return response.data || [];
}

async function searchPrograms({ municipalityId }) {
  const items = [];

  for (let page = 1; page <= PFDO_MAX_PAGES; page += 1) {
    const params = {
      operator: String(PFDO_OPERATOR_ID),
      "per-page": "100",
      page: String(page),
    };

    if (municipalityId) {
      params["search[mun]"] = String(municipalityId);
    }

    const response = await fetchJson(`/main-page/search/programs?${new URLSearchParams(params)}`);
    const batch = response.data || [];
    items.push(...batch);

    if (batch.length < 100) break;
  }

  return items;
}

async function getProgramDetail(programId) {
  const params = new URLSearchParams({
    expand:
      "address,program_image,registry,reestrs,direction,activity,is_open,available_groups,program_text,distance_technology,organization,images,interest,modules,rating,region,img_transparent,program_icons,program_nok_rating,phone,keywords",
  });

  const response = await fetchJson(`/public/programs/${programId}?${params}`);
  return response.data;
}

async function fetchJson(path) {
  const url = `${PFDO_API_BASE}${path}`;
  let lastError;

  for (let attempt = 1; attempt <= PFDO_REQUEST_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(PFDO_REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`PFDO request failed: ${response.status} ${url}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt === PFDO_REQUEST_RETRIES) {
        break;
      }

      await delay(Math.min(1000 * 2 ** (attempt - 1), 8000));
    }
  }

  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  fetchJson,
  getMunicipalities,
  getRegions,
  getOperatorInfo,
  getMunicipalityInfo,
  getMunicipalityUsefulContacts,
  searchPrograms,
  getProgramDetail,
  getProgramUrl,
  getOperatorId,
};
