const path = require("node:path");
const fs = require("node:fs/promises");
const { loadEnvFile } = require("../src/load-env");
const { getProgramUrl, getOperatorId } = require("../src/pfdo-config");

loadEnvFile();

const { executeSql, executeSqlFile, jsonToSql, textToSql } = require("../src/db");
const { fetchJson } = require("../src/pfdo");

const operatorId = getOperatorId();
const schemaPath = path.resolve(__dirname, "..", "db", "pfdo-mirror-schema.sql");
const importSqlPath = path.resolve(__dirname, "..", "tmp", "pfdo-mirror-import.sql");
const detailExpand = new URLSearchParams({
  expand:
    "address,program_image,registry,reestrs,direction,activity,is_open,available_groups,program_text,distance_technology,organization,images,interest,modules,rating,region,img_transparent,program_icons,program_nok_rating,phone,keywords",
}).toString();
const detailConcurrency = Math.max(1, Number(process.env.PFDO_IMPORT_CONCURRENCY || 6));
const sqlFlushBytes = Math.max(256 * 1024, Number(process.env.PFDO_IMPORT_SQL_FLUSH_BYTES || 4 * 1024 * 1024));

async function main() {
  configureMirrorDatabaseUrl();
  await fs.mkdir(path.dirname(importSqlPath), { recursive: true });
  await executeSqlFile(schemaPath);

  const writer = new SqlBatchWriter(importSqlPath, sqlFlushBytes);
  await writer.init();

  const counters = {
    regions: 0,
    mainMunicipalities: 0,
    usefulContacts: 0,
    programs: 0,
    modules: 0,
    groups: 0,
    scheduleEntries: 0,
    pedagogues: 0,
    rawDocuments: 0,
  };

  const seenDirections = new Set();
  const seenAddresses = new Set();
  const seenOrganizations = new Set();
  const seenPedagogues = new Set();

  const regionsResponse = await fetchJson("/main-page/regions");
  counters.rawDocuments += 1;
  await writer.write(renderRawDocument("main-page/regions", "/main-page/regions", regionsResponse));
  for (const region of regionsResponse.data || []) {
    await writer.write(renderRegion(region));
    counters.regions += 1;
  }

  const operatorInfoEndpoint = `/main-page/operator-info/${operatorId}`;
  const operatorInfoResponse = await fetchJson(operatorInfoEndpoint);
  counters.rawDocuments += 1;
  await writer.write(renderRawDocument(`main-page/operator-info/${operatorId}`, operatorInfoEndpoint, operatorInfoResponse));
  await writer.write(renderOperatorInfo(operatorId, operatorInfoResponse.data || {}));

  const mainMunicipalitiesEndpoint = `/main-page/muns/${operatorId}`;
  const mainMunicipalitiesResponse = await fetchJson(mainMunicipalitiesEndpoint);
  counters.rawDocuments += 1;
  await writer.write(
    renderRawDocument(`main-page/muns/${operatorId}`, mainMunicipalitiesEndpoint, mainMunicipalitiesResponse),
  );
  for (const item of mainMunicipalitiesResponse.data || []) {
    await writer.write(renderMainMunicipality(operatorId, item));
    counters.mainMunicipalities += 1;
  }

  const usefulContactsEndpoint = `/public/municipality-useful-contact?search[operator_id]=${operatorId}`;
  const usefulContactsResponse = await fetchJson(usefulContactsEndpoint);
  counters.rawDocuments += 1;
  await writer.write(
    renderRawDocument(
      `public/municipality-useful-contact?search[operator_id]=${operatorId}`,
      usefulContactsEndpoint,
      usefulContactsResponse,
    ),
  );
  const usefulContacts = usefulContactsResponse.data || [];
  const usefulContactsByMunicipality = groupUsefulContactsByMunicipality(usefulContacts);
  counters.usefulContacts = usefulContacts.length;

  const municipalityIds = (mainMunicipalitiesResponse.data || []).map((item) => item.id).filter(isFiniteNumber);
  for (const municipalityId of municipalityIds) {
    console.log(`Importing municipality info ${municipalityId}...`);
    const endpoint = `/main-page/info-mun/${municipalityId}`;
    const infoResponse = await fetchJson(endpoint);
    counters.rawDocuments += 1;
    await writer.write(renderRawDocument(`main-page/info-mun/${municipalityId}`, endpoint, infoResponse));
    await writer.write(
      renderMainMunicipalityInfo(
        operatorId,
        municipalityId,
        infoResponse.data || {},
        usefulContactsByMunicipality.get(municipalityId) || [],
      ),
    );
  }

  const programsById = new Map();
  for (const municipalityId of municipalityIds) {
    console.log(`Fetching program cards for municipality ${municipalityId}...`);
    const cards = await fetchProgramsForMunicipality(municipalityId, writer, counters);
    for (const item of cards) {
      if (!programsById.has(item.id)) {
        programsById.set(item.id, { ...item, municipality_id: municipalityId });
      }
    }
  }

  const programIds = [...programsById.keys()].sort((a, b) => a - b);
  console.log(`Fetching detailed program data for ${programIds.length} unique programs...`);

  for (let start = 0; start < programIds.length; start += detailConcurrency) {
    const batchIds = programIds.slice(start, start + detailConcurrency);
    const batch = await Promise.all(
      batchIds.map(async (programId) => {
        const endpoint = `/public/programs/${programId}?${detailExpand}`;
        const response = await fetchJson(endpoint);
        return {
          programId,
          endpoint,
          response,
          detail: response.data || {},
          searchItem: programsById.get(programId),
        };
      }),
    );

    for (const { programId, endpoint, response, detail, searchItem } of batch) {
      counters.rawDocuments += 1;
      await writer.write(renderRawDocument(`public/programs/${programId}`, endpoint, response));

      const direction = detail.direction || searchItem.direction || null;
      const address = detail.address || searchItem.address || null;
      const organization = detail.organization || null;

      if (direction?.id && !seenDirections.has(direction.id)) {
        await writer.write(renderDirection(direction));
        seenDirections.add(direction.id);
      }

      if (address?.id && !seenAddresses.has(address.id)) {
        await writer.write(renderAddress(address));
        seenAddresses.add(address.id);
      }

      if (organization?.id && !seenOrganizations.has(organization.id)) {
        await writer.write(renderOrganization(organization));
        seenOrganizations.add(organization.id);
      }

      await writer.write(renderProgram(operatorId, searchItem, detail));
      await writer.write(renderProgramLinks(programId, detail));
      await writer.write(renderProgramKeywords(programId, detail.keywords || []));
      await writer.write(renderProgramModules(programId, detail.modules || []));
      await writer.write(renderRegistryEntries(programId, detail.registry || []));
      const groupStats = renderGroups(programId, detail.available_groups || [], seenAddresses, seenPedagogues);
      await writer.write(groupStats.sql);

      counters.programs += 1;
      counters.modules += (detail.modules || []).length;
      counters.groups += groupStats.groups;
      counters.scheduleEntries += groupStats.scheduleEntries;
    }

    if (start + batch.length >= programIds.length || (start / detailConcurrency + 1) % 5 === 0) {
      console.log(`Prepared ${start + batch.length}/${programIds.length} programs`);
    }
  }

  counters.pedagogues = seenPedagogues.size;
  await writer.flush();

  console.log(
    JSON.stringify(
      {
        operatorId,
        municipalities: counters.mainMunicipalities,
        municipalityUsefulContactsImported: counters.usefulContacts,
        programsImported: counters.programs,
        modulesImported: counters.modules,
        groupsImported: counters.groups,
        scheduleEntriesImported: counters.scheduleEntries,
        pedagoguesImported: counters.pedagogues,
        rawDocumentsImported: counters.rawDocuments,
        importSqlPath,
      },
      null,
      2,
    ),
  );
}

function configureMirrorDatabaseUrl() {
  if (process.env.PFDO_MIRROR_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.PFDO_MIRROR_DATABASE_URL;
  }
}

async function fetchProgramsForMunicipality(municipalityId, writer, counters) {
  const items = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      operator: String(operatorId),
      "search[mun]": String(municipalityId),
      "per-page": "100",
      page: String(page),
    });
    const endpoint = `/main-page/search/programs?${params}`;
    const response = await fetchJson(endpoint);
    const batch = response.data || [];

    await writer.write(
      renderRawDocument(
        `main-page/search/programs:operator=${operatorId}:mun=${municipalityId}:page=${page}`,
        endpoint,
        response,
      ),
    );
    counters.rawDocuments += 1;
    items.push(...batch);

    if (batch.length < 100) {
      break;
    }

    page += 1;
  }

  return items;
}

function groupUsefulContactsByMunicipality(usefulContacts) {
  const contactsByMunicipality = new Map();

  for (const contact of usefulContacts) {
    if (!isFiniteNumber(contact.mun_id)) {
      continue;
    }

    const municipalityId = Number(contact.mun_id);
    const existingContacts = contactsByMunicipality.get(municipalityId) || [];
    existingContacts.push(contact);
    contactsByMunicipality.set(municipalityId, existingContacts);
  }

  return contactsByMunicipality;
}

class SqlBatchWriter {
  constructor(filePath, flushThresholdBytes) {
    this.filePath = filePath;
    this.flushThresholdBytes = flushThresholdBytes;
    this.buffer = [];
    this.bytes = 0;
  }

  async init() {
    this.buffer = [buildImportPreamble()];
    this.bytes = byteLength(this.buffer[0]);
    await fs.writeFile(this.filePath, "", "utf-8");
  }

  async write(sql) {
    if (!sql || !sql.trim()) {
      return;
    }

    this.buffer.push(sql);
    this.bytes += byteLength(sql);

    if (this.bytes >= this.flushThresholdBytes) {
      await this.flush();
    }
  }

  async flush() {
    if (!this.buffer.length) {
      return;
    }

    const sql = `${this.buffer.join("\n")}\n`;
    await fs.appendFile(this.filePath, sql, "utf-8");
    await executeSql(sql);
    this.buffer = [];
    this.bytes = 0;
  }
}

function buildImportPreamble() {
  return [
    "SET client_min_messages TO WARNING;",
    "TRUNCATE TABLE",
    "  pfdo_schedule_entry_pedagogues,",
    "  pfdo_group_schedule_entries,",
    "  pfdo_program_group_periods,",
    "  pfdo_group_addresses,",
    "  pfdo_program_groups,",
    "  pfdo_program_registry_entries,",
    "  pfdo_program_modules,",
    "  pfdo_program_activities,",
    "  pfdo_program_project_links,",
    "  pfdo_program_activity_links,",
    "  pfdo_programs,",
    "  pfdo_organizations,",
    "  pfdo_addresses,",
    "  pfdo_program_directions,",
    "  pfdo_main_municipalities,",
    "  pfdo_operator_info,",
    "  pfdo_regions,",
    "  pfdo_pedagogues,",
    "  pfdo_raw_documents",
    "RESTART IDENTITY;",
    "",
  ].join("\n");
}

function renderRegion(region) {
  const id = requiredNumber(region.id, "region.id");
  return `
INSERT INTO pfdo_regions (id, name, url, external, raw_payload, imported_at)
VALUES (${id}, ${textToSql(region.name)}, ${nullableText(region.url)}, ${region.external ? "TRUE" : "FALSE"}, ${jsonToSql(region)}, NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  url = EXCLUDED.url,
  external = EXCLUDED.external,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`;
}

function renderOperatorInfo(operatorIdValue, payload) {
  return `
INSERT INTO pfdo_operator_info (operator_id, raw_payload, imported_at)
VALUES (${requiredNumber(operatorIdValue, "operator_id")}, ${jsonToSql(payload)}, NOW())
ON CONFLICT (operator_id) DO UPDATE SET
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`;
}

function renderMainMunicipality(operatorIdValue, item) {
  const id = requiredNumber(item.id, "main_municipality.id");
  return `
INSERT INTO pfdo_main_municipalities (id, operator_id, name, raw_payload, imported_at)
VALUES (${id}, ${requiredNumber(operatorIdValue, "operator_id")}, ${textToSql(item.name)}, ${jsonToSql(item)}, NOW())
ON CONFLICT (id) DO UPDATE SET
  operator_id = EXCLUDED.operator_id,
  name = EXCLUDED.name,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`;
}

function renderMainMunicipalityInfo(operatorIdValue, municipalityId, payload, usefulContacts) {
  return `
INSERT INTO pfdo_main_municipalities (
  id, operator_id, name, info_html, useful_contacts, useful_contacts_count, raw_payload, imported_at
)
VALUES (
  ${requiredNumber(municipalityId, "municipality_id")},
  ${requiredNumber(operatorIdValue, "operator_id")},
  ${nullableText(payload.name)},
  ${nullableText(payload.text)},
  ${jsonToSql(usefulContacts)},
  ${usefulContacts.length},
  ${jsonToSql({ info: payload })},
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  operator_id = EXCLUDED.operator_id,
  name = COALESCE(EXCLUDED.name, pfdo_main_municipalities.name),
  info_html = EXCLUDED.info_html,
  useful_contacts = EXCLUDED.useful_contacts,
  useful_contacts_count = EXCLUDED.useful_contacts_count,
  raw_payload = pfdo_main_municipalities.raw_payload || jsonb_build_object('info', EXCLUDED.raw_payload),
  imported_at = NOW();`;
}

function renderDirection(direction) {
  return `
INSERT INTO pfdo_program_directions (id, name, icon, imported_at)
VALUES (${requiredNumber(direction.id, "direction.id")}, ${textToSql(direction.name)}, ${nullableText(direction.icon)}, NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  imported_at = NOW();`;
}

function renderAddress(address) {
  return `
INSERT INTO pfdo_addresses (id, name, lat, lng, raw_payload, imported_at)
VALUES (${requiredNumber(address.id, "address.id")}, ${textToSql(address.name)}, ${nullableText(address.lat)}, ${nullableText(address.lng)}, ${jsonToSql(address)}, NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`;
}

function renderOrganization(organization) {
  return `
INSERT INTO pfdo_organizations (id, name, phone, organizational_form, level_id, raw_payload, imported_at)
VALUES (${requiredNumber(organization.id, "organization.id")}, ${textToSql(organization.name)}, ${nullableText(organization.phone)}, ${nullableNumber(organization.organizational_form)}, ${nullableNumber(organization.level_id)}, ${jsonToSql(organization)}, NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  organizational_form = EXCLUDED.organizational_form,
  level_id = EXCLUDED.level_id,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`;
}

function renderProgram(operatorIdValue, searchItem, detail) {
  const program = detail.program || {};
  const direction = detail.direction || searchItem.direction || null;
  const programId = requiredNumber(searchItem.id, "program.id");
  const municipalityId = searchItem.municipality_id ?? program.mun;

  return `
INSERT INTO pfdo_programs (
  id, operator_id, municipality_id, search_name, full_name, short_name, kind, direction_id,
  edu_form, duration_year, duration_month, age_group_min, age_group_max, need_medical_certificate,
  modules_count, directory_level_id, directory_program_document_id, video_link, annotation_html,
  task_html, duration_string, organization_id, organization_name, address_name, all_region,
  enrollment, source_url, search_payload, detail_payload, imported_at
)
VALUES (
  ${programId},
  ${requiredNumber(operatorIdValue, "operator_id")},
  ${nullableNumber(municipalityId)},
  ${textToSql(searchItem.name)},
  ${nullableText(program.full_name)},
  ${nullableText(program.short_name)},
  ${nullableNumber(program.kind)},
  ${nullableNumber(direction?.id)},
  ${nullableNumber(program.edu_form)},
  ${nullableNumber(program.duration_year)},
  ${nullableNumber(program.duration_month)},
  ${nullableNumber(program.age_group_min)},
  ${nullableNumber(program.age_group_max)},
  ${nullableNumber(program.need_medical_certificate)},
  ${nullableNumber(program.modules_count)},
  ${nullableNumber(program.directory_level_id)},
  ${nullableNumber(program.directory_program_document_id)},
  ${nullableText(program.video_link)},
  ${nullableText(program.annotation)},
  ${nullableText(program.task)},
  ${nullableText(searchItem.duration_string)},
  ${nullableNumber(detail.organization?.id)},
  ${nullableText(searchItem.organization_name)},
  ${nullableText(searchItem.address?.name)},
  ${nullableNumber(searchItem.all_region)},
  ${nullableNumber(searchItem.enrollment)},
  ${textToSql(getProgramUrl(searchItem.id))},
  ${jsonToSql(stripRemovedProgramAttributes(searchItem))},
  ${jsonToSql(stripRemovedProgramAttributes(detail))},
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  operator_id = EXCLUDED.operator_id,
  municipality_id = EXCLUDED.municipality_id,
  search_name = EXCLUDED.search_name,
  full_name = EXCLUDED.full_name,
  short_name = EXCLUDED.short_name,
  kind = EXCLUDED.kind,
  direction_id = EXCLUDED.direction_id,
  edu_form = EXCLUDED.edu_form,
  duration_year = EXCLUDED.duration_year,
  duration_month = EXCLUDED.duration_month,
  age_group_min = EXCLUDED.age_group_min,
  age_group_max = EXCLUDED.age_group_max,
  need_medical_certificate = EXCLUDED.need_medical_certificate,
  modules_count = EXCLUDED.modules_count,
  directory_level_id = EXCLUDED.directory_level_id,
  directory_program_document_id = EXCLUDED.directory_program_document_id,
  video_link = EXCLUDED.video_link,
  annotation_html = EXCLUDED.annotation_html,
  task_html = EXCLUDED.task_html,
  duration_string = EXCLUDED.duration_string,
  organization_id = EXCLUDED.organization_id,
  organization_name = EXCLUDED.organization_name,
  address_name = EXCLUDED.address_name,
  all_region = EXCLUDED.all_region,
  enrollment = EXCLUDED.enrollment,
  source_url = EXCLUDED.source_url,
  search_payload = EXCLUDED.search_payload,
  detail_payload = EXCLUDED.detail_payload,
  imported_at = NOW();`;
}

function renderProgramLinks(programId, detail) {
  const parts = [];
  const normalizedProgramId = requiredNumber(programId, "program_id");
  const program = detail.program || {};

  for (const activityId of program.activity_ids || []) {
    const normalizedActivityId = nullableNumber(activityId);
    if (normalizedActivityId === "NULL") {
      continue;
    }

    parts.push(`
INSERT INTO pfdo_program_activity_links (program_id, activity_id)
VALUES (${normalizedProgramId}, ${normalizedActivityId})
ON CONFLICT (program_id, activity_id) DO NOTHING;`);
  }

  for (const projectId of program.directory_project_ids || []) {
    const normalizedProjectId = nullableNumber(projectId);
    if (normalizedProjectId === "NULL") {
      continue;
    }

    parts.push(`
INSERT INTO pfdo_program_project_links (program_id, project_id)
VALUES (${normalizedProgramId}, ${normalizedProjectId})
ON CONFLICT (program_id, project_id) DO NOTHING;`);
  }

  for (const activityName of detail.activity || []) {
    parts.push(`
INSERT INTO pfdo_program_activities (program_id, activity_name)
VALUES (${normalizedProgramId}, ${textToSql(activityName)})
ON CONFLICT (program_id, activity_name) DO NOTHING;`);
  }

  return parts.join("\n");
}

function renderProgramKeywords(programId, keywords) {
  const normalizedProgramId = requiredNumber(programId, "program_id");
  const parts = [
    `DELETE FROM pfdo_program_keyword_links WHERE program_id = ${normalizedProgramId};`,
  ];

  for (const keyword of keywords) {
    if (!isFiniteNumber(keyword?.id) || !keyword.name) {
      continue;
    }

    const keywordId = requiredNumber(keyword.id, "keyword.id");
    parts.push(`
INSERT INTO pfdo_program_keywords (id, name, raw_payload, imported_at)
VALUES (${keywordId}, ${textToSql(keyword.name)}, ${jsonToSql(keyword)}, NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`);

    parts.push(`
INSERT INTO pfdo_program_keyword_links (program_id, keyword_id)
VALUES (${normalizedProgramId}, ${keywordId})
ON CONFLICT (program_id, keyword_id) DO NOTHING;`);
  }

  return parts.join("\n");
}

function renderProgramModules(programId, modules) {
  const normalizedProgramId = requiredNumber(programId, "program_id");

  return modules
    .filter((moduleItem) => isFiniteNumber(moduleItem.id))
    .map(
      (moduleItem) => `
INSERT INTO pfdo_program_modules (
  id, program_id, name, month, hours_group, hours_group_dop, min_child_group, max_child_group,
  teacher_level_id, teacher_category_id, teacher_skill_level_id, normative_price, price, results_html,
  raw_payload, imported_at
)
VALUES (
  ${requiredNumber(moduleItem.id, "module.id")},
  ${normalizedProgramId},
  ${textToSql(moduleItem.name)},
  ${nullableNumber(moduleItem.month)},
  ${nullableText(moduleItem.hours_group)},
  ${nullableText(moduleItem.hours_group_dop)},
  ${nullableNumber(moduleItem.min_child_group)},
  ${nullableNumber(moduleItem.max_child_group)},
  ${nullableNumber(moduleItem.teacher_level_id)},
  ${nullableNumber(moduleItem.teacher_category_id)},
  ${nullableNumber(moduleItem.teacher_skill_level_id)},
  ${nullableText(moduleItem.normative_price)},
  ${nullableText(moduleItem.price)},
  ${nullableText(moduleItem.results)},
  ${jsonToSql(moduleItem)},
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  program_id = EXCLUDED.program_id,
  name = EXCLUDED.name,
  month = EXCLUDED.month,
  hours_group = EXCLUDED.hours_group,
  hours_group_dop = EXCLUDED.hours_group_dop,
  min_child_group = EXCLUDED.min_child_group,
  max_child_group = EXCLUDED.max_child_group,
  teacher_level_id = EXCLUDED.teacher_level_id,
  teacher_category_id = EXCLUDED.teacher_category_id,
  teacher_skill_level_id = EXCLUDED.teacher_skill_level_id,
  normative_price = EXCLUDED.normative_price,
  price = EXCLUDED.price,
  results_html = EXCLUDED.results_html,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`,
    )
    .join("\n");
}

function renderRegistryEntries(programId, entries) {
  const normalizedProgramId = requiredNumber(programId, "program_id");

  return entries
    .filter((registryItem) => isFiniteNumber(registryItem.value))
    .map(
      (registryItem) => `
INSERT INTO pfdo_program_registry_entries (
  program_id, registry_value, name, status, tooltip, button_name, button_active, button_tooltip,
  reasons, raw_payload, imported_at
)
VALUES (
  ${normalizedProgramId},
  ${requiredNumber(registryItem.value, "registry.value")},
  ${nullableText(registryItem.name)},
  ${nullableNumber(registryItem.status)},
  ${nullableText(registryItem.tooltip)},
  ${nullableText(registryItem.button?.name)},
  ${nullableNumber(registryItem.button?.active)},
  ${nullableText(registryItem.button?.tooltip)},
  ${jsonToSql(registryItem.reasons || [])},
  ${jsonToSql(registryItem)},
  NOW()
)
ON CONFLICT (program_id, registry_value) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  tooltip = EXCLUDED.tooltip,
  button_name = EXCLUDED.button_name,
  button_active = EXCLUDED.button_active,
  button_tooltip = EXCLUDED.button_tooltip,
  reasons = EXCLUDED.reasons,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`,
    )
    .join("\n");
}

function renderGroups(programId, groups, seenAddresses, seenPedagogues) {
  const normalizedProgramId = requiredNumber(programId, "program_id");
  const parts = [];
  let scheduleEntries = 0;
  let groupsImported = 0;

  for (const group of groups) {
    if (!isFiniteNumber(group.id)) {
      continue;
    }

    groupsImported += 1;

    if (group.main_pedagogue?.id && !seenPedagogues.has(group.main_pedagogue.id)) {
      parts.push(renderPedagogue(group.main_pedagogue));
      seenPedagogues.add(group.main_pedagogue.id);
    }

    parts.push(`
INSERT INTO pfdo_program_groups (
  id, program_id, organization_id, module_id, name, start_date, end_date, status, free_places_counter,
  typical_lesson_duration_minutes, module_name, recommended_min_age_for_enrollment,
  recommended_max_age_for_enrollment, extra_places, period_price, main_pedagogue_id, raw_payload, imported_at
)
VALUES (
  ${requiredNumber(group.id, "group.id")},
  ${normalizedProgramId},
  ${nullableNumber(group.organization_id)},
  ${nullableNumber(group.module_id)},
  ${textToSql(group.name)},
  ${nullableText(group.start_date)},
  ${nullableText(group.end_date)},
  ${nullableNumber(group.status)},
  ${nullableNumber(group.free_places_counter)},
  ${nullableNumber(group.typical_lesson_duration_minutes)},
  ${nullableText(group.module_name)},
  ${nullableNumber(group.recommended_min_age_for_enrollment)},
  ${nullableNumber(group.recommended_max_age_for_enrollment)},
  ${nullableNumber(group.extra_places)},
  ${nullableText(group.period_price)},
  ${nullableNumber(group.main_pedagogue?.id)},
  ${jsonToSql(group)},
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  program_id = EXCLUDED.program_id,
  organization_id = EXCLUDED.organization_id,
  module_id = EXCLUDED.module_id,
  name = EXCLUDED.name,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  status = EXCLUDED.status,
  free_places_counter = EXCLUDED.free_places_counter,
  typical_lesson_duration_minutes = EXCLUDED.typical_lesson_duration_minutes,
  module_name = EXCLUDED.module_name,
  recommended_min_age_for_enrollment = EXCLUDED.recommended_min_age_for_enrollment,
  recommended_max_age_for_enrollment = EXCLUDED.recommended_max_age_for_enrollment,
  extra_places = EXCLUDED.extra_places,
  period_price = EXCLUDED.period_price,
  main_pedagogue_id = EXCLUDED.main_pedagogue_id,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`);

    for (const groupAddress of group.addresses || []) {
      if (groupAddress.id && !seenAddresses.has(groupAddress.id)) {
        parts.push(renderAddress(groupAddress));
        seenAddresses.add(groupAddress.id);
      }

      if (!isFiniteNumber(groupAddress.id)) {
        continue;
      }

      parts.push(`
INSERT INTO pfdo_group_addresses (group_id, address_id, office_id, office_name)
VALUES (${requiredNumber(group.id, "group.id")}, ${requiredNumber(groupAddress.id, "group_address.id")}, ${nullableNumber(groupAddress.office_id)}, ${nullableText(groupAddress.office_name)})
ON CONFLICT (group_id, address_id, office_id) DO NOTHING;`);
    }

    for (const period of group.periods || []) {
      if (!isFiniteNumber(period.hash)) {
        continue;
      }

      parts.push(`
INSERT INTO pfdo_program_group_periods (group_id, period_hash, start_date, end_date, raw_payload, imported_at)
VALUES (${requiredNumber(group.id, "group.id")}, ${requiredNumber(period.hash, "period.hash")}, ${nullableText(period.start_date)}, ${nullableText(period.end_date)}, ${jsonToSql(period)}, NOW())
ON CONFLICT (group_id, period_hash) DO UPDATE SET
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`);

      for (const entries of Object.values(period.schedule || {})) {
        for (const entry of entries) {
          if (!isFiniteNumber(entry.id)) {
            continue;
          }

          scheduleEntries += 1;
          parts.push(`
INSERT INTO pfdo_group_schedule_entries (
  id, group_id, period_hash, week_day, start_time, end_time, office_id, office_name,
  office_address, hours_count, week_policy, is_odd, week_number, group_type, subject,
  raw_payload, imported_at
)
VALUES (
  ${requiredNumber(entry.id, "schedule_entry.id")},
  ${requiredNumber(group.id, "group.id")},
  ${requiredNumber(period.hash, "period.hash")},
  ${nullableText(entry.week_day)},
  ${nullableText(entry.start_time)},
  ${nullableText(entry.end_time)},
  ${nullableNumber(entry.office_id)},
  ${nullableText(entry.office_name)},
  ${nullableText(entry.office_address)},
  ${nullableText(entry.hours_count)},
  ${nullableNumber(entry.week_policy)},
  ${nullableNumber(entry.is_odd)},
  ${nullableNumber(entry.week_number)},
  ${nullableNumber(entry.group_type)},
  ${nullableText(entry.subject)},
  ${jsonToSql(entry)},
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  group_id = EXCLUDED.group_id,
  period_hash = EXCLUDED.period_hash,
  week_day = EXCLUDED.week_day,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  office_id = EXCLUDED.office_id,
  office_name = EXCLUDED.office_name,
  office_address = EXCLUDED.office_address,
  hours_count = EXCLUDED.hours_count,
  week_policy = EXCLUDED.week_policy,
  is_odd = EXCLUDED.is_odd,
  week_number = EXCLUDED.week_number,
  group_type = EXCLUDED.group_type,
  subject = EXCLUDED.subject,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`);

          for (const pedagogue of entry.pedagogues || []) {
            if (!isFiniteNumber(pedagogue.id)) {
              continue;
            }

            if (!seenPedagogues.has(pedagogue.id)) {
              parts.push(renderPedagogue(pedagogue));
              seenPedagogues.add(pedagogue.id);
            }

            parts.push(`
INSERT INTO pfdo_schedule_entry_pedagogues (schedule_entry_id, pedagogue_id)
VALUES (${requiredNumber(entry.id, "schedule_entry.id")}, ${requiredNumber(pedagogue.id, "pedagogue.id")})
ON CONFLICT (schedule_entry_id, pedagogue_id) DO NOTHING;`);
          }
        }
      }
    }
  }

  return {
    sql: parts.join("\n"),
    groups: groupsImported,
    scheduleEntries,
  };
}

function renderPedagogue(pedagogue) {
  return `
INSERT INTO pfdo_pedagogues (id, first_name, last_name, middle_name, raw_payload, imported_at)
VALUES (${requiredNumber(pedagogue.id, "pedagogue.id")}, ${nullableText(pedagogue.first_name)}, ${nullableText(pedagogue.last_name)}, ${nullableText(pedagogue.middle_name)}, ${jsonToSql(pedagogue)}, NOW())
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  middle_name = EXCLUDED.middle_name,
  raw_payload = EXCLUDED.raw_payload,
  imported_at = NOW();`;
}

function renderRawDocument(documentKey, endpoint, payload) {
  return `
INSERT INTO pfdo_raw_documents (document_key, endpoint, payload, imported_at)
VALUES (${textToSql(documentKey)}, ${textToSql(endpoint)}, ${jsonToSql(stripRemovedProgramAttributes(payload))}, NOW())
ON CONFLICT (document_key) DO UPDATE SET
  endpoint = EXCLUDED.endpoint,
  payload = EXCLUDED.payload,
  imported_at = NOW();`;
}

function stripRemovedProgramAttributes(value) {
  if (Array.isArray(value)) {
    return value.map(stripRemovedProgramAttributes);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "average_score" || key === "distance" || key === "program_reviews") {
      continue;
    }
    result[key] = stripRemovedProgramAttributes(child);
  }

  return result;
}

function nullableText(value) {
  return value == null || value === "" ? "NULL" : textToSql(value);
}

function nullableNumber(value) {
  if (value == null || value === "") {
    return "NULL";
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : "NULL";
}

function requiredNumber(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Expected numeric value for ${label}`);
  }

  return String(numeric);
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf-8") + 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  SqlBatchWriter,
  buildImportPreamble,
  detailExpand,
  fetchProgramsForMunicipality,
  renderAddress,
  renderDirection,
  renderGroups,
  renderOrganization,
  renderPedagogue,
  renderProgram,
  renderProgramKeywords,
  renderProgramLinks,
  renderProgramModules,
  renderRawDocument,
  renderRegistryEntries,
  stripRemovedProgramAttributes,
};
