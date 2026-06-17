# FigJam-схемы проекта

Статус: подготовлено 2026-06-17 для обновления FigJam-доски.

Этот файл хранит актуальные Mermaid-источники схем проекта. Их можно вставить в FigJam через Mermaid/import diagram или сгенерировать через Figma `generate_diagram`.

## Runtime architecture

```mermaid
flowchart LR
  user(["Родитель"])

  subgraph channels ["Каналы и сайт"]
    telegram["Telegram"]
    max["MAX"]
    webChat["web-chat"]
    mattermost["Mattermost"]
    alice["Яндекс Алиса"]
    landing["landing page"]
  end

  subgraph runtime ["Node.js runtime"]
    bootstrap["src/index.js"]
    menu["командное меню"]
    scenarios["сценарии 1-4"]
    description["description flow"]
    trajectory["deep-trajectory"]
    recommendations["recommendations"]
    scoring["scoring-model"]
    ontology["query-ontology"]
    pdf["PDF generator"]
  end

  subgraph data ["PostgreSQL и данные"]
    botDb[("telegram_bot")]
    mirror[("pfdo_51_mirror")]
    topics[("темы и классификации")]
    syncState[("sync runs и state")]
  end

  subgraph jobs ["PFDO jobs"]
    sync["pfdo:sync"]
    importer["import mirror"]
    docs["download documents"]
    analytics["topic analytics"]
  end

  subgraph external ["Внешние сервисы"]
    pfdoApi["PFDO API"]
    metrika["Яндекс Метрика"]
  end

  user --> landing
  user --> telegram
  user --> max
  user --> webChat
  user --> mattermost
  user --> alice
  landing --> webChat
  landing -.-> metrika
  telegram --> bootstrap
  max --> bootstrap
  webChat --> bootstrap
  mattermost --> bootstrap
  alice --> bootstrap
  bootstrap --> menu
  menu --> scenarios
  scenarios --> description
  scenarios --> trajectory
  description --> recommendations
  trajectory --> recommendations
  recommendations --> scoring
  recommendations --> ontology
  recommendations --> mirror
  trajectory --> topics
  scenarios --> pdf
  bootstrap --> botDb
  recommendations --> botDb
  sync --> importer
  importer -.-> pfdoApi
  importer --> mirror
  sync --> docs
  docs --> mirror
  sync --> analytics
  analytics --> topics
  sync --> syncState
  topics --> recommendations

  style channels fill:#C2E5FF,stroke:#3DADFF
  style runtime fill:#DCCCFF,stroke:#874FFF
  style data fill:#CDF4D3,stroke:#66D575
  style jobs fill:#FFECBD,stroke:#FFC943
  style external fill:#FFE0C2,stroke:#FF9E42
```

## PFDO data sync pipeline

```mermaid
flowchart LR
  timer(["systemd timer"])
  manual(["manual trigger"])
  scenario(["scenario 3/4 missing program"])

  subgraph orchestration ["Sync orchestration"]
    sync["scripts/sync-pfdo-programs.js"]
    syncRuns[("pfdo_sync_runs")]
    syncState[("pfdo_program_sync_state")]
    onDemand["src/pfdo-program-sync.js"]
  end

  subgraph importLayer ["PFDO import"]
    pfdoApi["PFDO API"]
    mirrorImport["import-pfdo-mirror.js"]
    programDetail["program detail import"]
    mirror[("pfdo_51_mirror")]
  end

  subgraph documentLayer ["Documents and topics"]
    download["download-pfdo-program-documents.js"]
    files[("tmp/program_docs")]
    topicImport["import-pfdo-calendar-topics.js"]
    rawTopics[("pfdo_program_calendar_topics")]
    analytics["build-pfdo-topic-analytics.js"]
    derived[("normalizations, aggregates, classifications")]
  end

  subgraph runtimeUse ["Runtime usage"]
    catalog["scenario 1/2 catalog search"]
    deep["scenario 3 deep trajectory"]
    wide["scenario 4 new interests"]
    scoring["scoring-model"]
  end

  timer --> sync
  manual --> sync
  scenario --> onDemand
  sync --> syncRuns
  sync --> syncState
  sync --> mirrorImport
  mirrorImport -.-> pfdoApi
  mirrorImport --> mirror
  onDemand -.-> pfdoApi
  onDemand --> programDetail
  programDetail --> mirror
  onDemand --> syncState
  sync --> download
  download --> mirror
  download --> files
  sync --> topicImport
  topicImport --> files
  topicImport --> rawTopics
  topicImport --> analytics
  analytics --> derived
  analytics --> syncState
  mirror --> catalog
  mirror --> deep
  mirror --> wide
  derived --> deep
  derived --> wide
  catalog --> scoring
  deep --> scoring
  wide --> scoring

  style orchestration fill:#FFECBD,stroke:#FFC943
  style importLayer fill:#C2E5FF,stroke:#3DADFF
  style documentLayer fill:#CDF4D3,stroke:#66D575
  style runtimeUse fill:#DCCCFF,stroke:#874FFF
```

## Scenario and recommendation flow

```mermaid
flowchart LR
  start(["/start или меню"])

  subgraph channels ["Каналы"]
    telegram["Telegram commands"]
    max["MAX commands"]
    webChat["web-chat menu"]
    mattermost["Mattermost numbers"]
  end

  subgraph scenarioEntry ["Выбор сценария"]
    text["/text: по описанию"]
    quiz["/quiz: AI-вопросы"]
    deep["/deep: углубить"]
    wide["/wide: новые интересы"]
  end

  subgraph profileBuild ["Сбор профиля"]
    freeText["свободный текст"]
    questionnaire["пошаговая анкета"]
    pfdoLinks["1-5 PFDO ссылок"]
    completedReview["обзор пройденных тем"]
    criteria["критерии поиска"]
  end

  subgraph recommendation ["Рекомендации"]
    queryOntology["query ontology"]
    catalog["PFDO mirror candidates"]
    scoring["unified scoring"]
    exactBuckets["specific-interest buckets"]
    deepScoring["depth signals"]
    wideScoring["novelty signals"]
    result["до 10 программ"]
  end

  subgraph output ["Выдача"]
    explanation["объяснение выбора"]
    history[("recommendation_history")]
    pdf["PDF-файл"]
  end

  start --> telegram
  start --> max
  start --> webChat
  start --> mattermost
  telegram --> text
  telegram --> quiz
  telegram --> deep
  telegram --> wide
  max --> text
  max --> quiz
  max --> deep
  max --> wide
  webChat --> text
  webChat --> quiz
  webChat --> deep
  webChat --> wide
  mattermost --> text
  mattermost --> quiz
  mattermost --> deep
  mattermost --> wide
  text --> freeText
  quiz --> questionnaire
  deep --> pfdoLinks
  wide --> pfdoLinks
  pfdoLinks --> completedReview
  completedReview --> criteria
  freeText --> queryOntology
  questionnaire --> queryOntology
  criteria --> catalog
  queryOntology --> catalog
  catalog --> scoring
  scoring --> exactBuckets
  scoring --> deepScoring
  scoring --> wideScoring
  exactBuckets --> result
  deepScoring --> result
  wideScoring --> result
  result --> explanation
  result --> history
  result --> pdf

  style channels fill:#C2E5FF,stroke:#3DADFF
  style scenarioEntry fill:#FFECBD,stroke:#FFC943
  style profileBuild fill:#CDF4D3,stroke:#66D575
  style recommendation fill:#DCCCFF,stroke:#874FFF
  style output fill:#FFE0C2,stroke:#FF9E42
```
