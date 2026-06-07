const PFDO_API_BASE = process.env.PFDO_API_BASE || "https://api.pfdo.ru/v2";
const PFDO_PORTAL_BASE = process.env.PFDO_PORTAL_BASE || "https://51.pfdo.ru";
const PFDO_OPERATOR_ID = Number(process.env.PFDO_OPERATOR_ID || 37);

function getProgramUrl(programId) {
  return `${PFDO_PORTAL_BASE}/app/public/program/${programId}`;
}

function getOperatorId() {
  return PFDO_OPERATOR_ID;
}

module.exports = {
  PFDO_API_BASE,
  PFDO_PORTAL_BASE,
  PFDO_OPERATOR_ID,
  getProgramUrl,
  getOperatorId,
};
