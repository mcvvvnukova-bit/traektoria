from __future__ import annotations

import csv
import math
import random
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np


BASE_DIR = Path(__file__).resolve().parents[1]
INPUT_PATH = BASE_DIR / "exports" / "программы и темы технической направленности.csv"
SUMMARY_PATH = BASE_DIR / "exports" / "technical_topic_clusters_summary.csv"
TOPICS_PATH = BASE_DIR / "exports" / "technical_topic_clusters.csv"
REPORT_PATH = BASE_DIR / "exports" / "кластеры тем технической направленности.md"

K = 32
HASH_DIM = 4096
SEED = 42

STOPWORDS = {
    "без",
    "для",
    "или",
    "как",
    "над",
    "при",
    "про",
    "что",
    "это",
    "его",
    "она",
    "они",
    "оно",
    "под",
    "темы",
    "тема",
    "занятие",
    "занятия",
    "занятий",
    "работа",
    "работы",
    "практическая",
    "практические",
    "практическое",
    "теория",
    "практика",
    "итоговое",
    "итоговая",
    "вводное",
    "повторение",
    "диагностика",
    "основы",
    "освоение",
    "изучение",
    "знакомство",
}


def main() -> None:
    rows = read_rows(INPUT_PATH)
    topics = aggregate_topics(rows)
    matrix, feature_names = build_matrix(topics)
    labels = weighted_kmeans(matrix, np.array([item["weight"] for item in topics], dtype=np.float32), K)
    summaries = build_summaries(rows, topics, labels, matrix, feature_names)

    write_topic_rows(topics, labels, summaries)
    write_summary(summaries)
    write_report(summaries)

    print(
        {
            "input_rows": len(rows),
            "unique_topics": len(topics),
            "clusters": len(summaries),
            "summary_path": str(SUMMARY_PATH),
            "topics_path": str(TOPICS_PATH),
            "report_path": str(REPORT_PATH),
        }
    )


def read_rows(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def aggregate_topics(rows: list[dict]) -> list[dict]:
    grouped: dict[str, dict] = {}
    originals: dict[str, Counter] = defaultdict(Counter)
    programs: dict[str, set] = defaultdict(set)

    for row in rows:
        normalized = normalize_topic(row["topic_name"])
        if not normalized:
            continue

        if normalized not in grouped:
            grouped[normalized] = {
                "normalized_topic": normalized,
                "topic_rows": 0,
                "hours_total": 0.0,
            }

        grouped[normalized]["topic_rows"] += 1
        grouped[normalized]["hours_total"] += safe_float(row.get("hours_total"))
        originals[normalized][row["topic_name"].strip()] += 1
        programs[normalized].add(row["portal_url"])

    topics = []
    for normalized, item in grouped.items():
        representative = originals[normalized].most_common(1)[0][0]
        program_count = len(programs[normalized])
        topics.append(
            {
                **item,
                "topic_name": representative,
                "program_count": program_count,
                "weight": math.sqrt(item["topic_rows"]) + math.sqrt(program_count),
            }
        )

    topics.sort(key=lambda item: (-item["topic_rows"], item["normalized_topic"]))
    return topics


def build_matrix(topics: list[dict]) -> tuple[np.ndarray, list[str]]:
    documents = [topic_tokens(item["normalized_topic"]) for item in topics]
    df = Counter()
    for tokens in documents:
        df.update(set(tokens))

    features = [token for token, count in df.items() if count >= 2]
    features.sort(key=lambda token: (-df[token], token))
    features = features[:HASH_DIM]
    feature_index = {token: index for index, token in enumerate(features)}

    matrix = np.zeros((len(documents), len(features)), dtype=np.float32)
    total_docs = len(documents)
    for row_index, tokens in enumerate(documents):
        counts = Counter(token for token in tokens if token in feature_index)
        for token, count in counts.items():
            col_index = feature_index[token]
            idf = math.log((1 + total_docs) / (1 + df[token])) + 1
            matrix[row_index, col_index] = (1 + math.log(count)) * idf

    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    matrix /= norms
    return matrix, features


def weighted_kmeans(matrix: np.ndarray, weights: np.ndarray, k: int) -> np.ndarray:
    rng = random.Random(SEED)
    if len(matrix) <= k:
        return np.arange(len(matrix), dtype=np.int32)

    centers = initialize_centers(matrix, weights, k, rng)
    labels = np.zeros(len(matrix), dtype=np.int32)

    for _ in range(80):
        similarity = matrix @ centers.T
        next_labels = np.argmax(similarity, axis=1).astype(np.int32)
        if np.array_equal(labels, next_labels):
            break
        labels = next_labels

        for cluster in range(k):
            indexes = np.where(labels == cluster)[0]
            if len(indexes) == 0:
                centers[cluster] = matrix[rng.randrange(len(matrix))]
                continue
            weighted = matrix[indexes] * weights[indexes, None]
            center = weighted.sum(axis=0) / max(float(weights[indexes].sum()), 1e-6)
            norm = np.linalg.norm(center)
            centers[cluster] = center / norm if norm else center

    return labels


def initialize_centers(matrix: np.ndarray, weights: np.ndarray, k: int, rng: random.Random) -> np.ndarray:
    first = int(np.argmax(weights))
    centers = [matrix[first].copy()]
    min_distance = np.ones(len(matrix), dtype=np.float32)

    for _ in range(1, k):
        similarity = matrix @ np.vstack(centers).T
        distance = 1 - similarity.max(axis=1)
        min_distance = np.minimum(min_distance, distance)
        scores = min_distance * weights
        next_index = int(np.argmax(scores))
        if scores[next_index] <= 0:
            next_index = rng.randrange(len(matrix))
        centers.append(matrix[next_index].copy())

    return np.vstack(centers).astype(np.float32)


def build_summaries(
    rows: list[dict],
    topics: list[dict],
    labels: np.ndarray,
    matrix: np.ndarray,
    feature_names: list[str],
) -> list[dict]:
    cluster_topics: dict[int, list[int]] = defaultdict(list)
    for index, label in enumerate(labels):
        cluster_topics[int(label)].append(index)

    program_urls_by_cluster: dict[int, set] = defaultdict(set)
    for row in rows:
        normalized = normalize_topic(row["topic_name"])
        if not normalized:
            continue
        topic_index = next((i for i, item in enumerate(topics) if item["normalized_topic"] == normalized), None)
        if topic_index is not None:
            program_urls_by_cluster[int(labels[topic_index])].add(row["portal_url"])

    summaries = []
    for label, indexes in cluster_topics.items():
        topic_items = [topics[index] for index in indexes]
        top_topic_items = sorted(topic_items, key=lambda item: (-item["topic_rows"], -item["program_count"], item["topic_name"]))
        top_terms = cluster_top_terms(indexes, matrix, feature_names)
        cluster_name = name_cluster(top_terms, top_topic_items)
        summaries.append(
            {
                "cluster_id": label,
                "cluster_name": cluster_name,
                "unique_topics": len(topic_items),
                "topic_rows": sum(item["topic_rows"] for item in topic_items),
                "program_count": len(program_urls_by_cluster[label]),
                "hours_total": round(sum(item["hours_total"] for item in topic_items), 2),
                "top_terms": "; ".join(top_terms[:12]),
                "examples": " | ".join(item["topic_name"] for item in top_topic_items[:8]),
            }
        )

    summaries.sort(key=lambda item: (-item["topic_rows"], item["cluster_name"]))
    for order, summary in enumerate(summaries, start=1):
        summary["cluster_number"] = order
    return summaries


def cluster_top_terms(indexes: list[int], matrix: np.ndarray, feature_names: list[str]) -> list[str]:
    centroid = matrix[indexes].mean(axis=0)
    top_indexes = np.argsort(-centroid)[:30]
    terms = []
    for index in top_indexes:
        term = feature_names[int(index)]
        if term.startswith("char:"):
            continue
        clean = term.replace("word:", "").replace("bigram:", "")
        if clean not in terms and len(clean) > 2:
            terms.append(clean)
        if len(terms) >= 12:
            break
    return terms


def name_cluster(top_terms: list[str], top_topic_items: list[dict]) -> str:
    term_text = " ".join(top_terms[:10])
    rules = [
        (("робот", "lego", "wedo", "ev3"), "Робототехника и LEGO"),
        (("программирован", "python", "java", "pascal", "scratch", "алгоритм"), "Программирование и алгоритмы"),
        (("компьютер", "информат", "цифров", "office", "word", "excel"), "Компьютерная грамотность и ИКТ"),
        (("3d", "модел", "прототип", "печать"), "3D-моделирование и прототипирование"),
        (("видео", "монтаж", "мульт", "анимац", "медиа"), "Медиа, видео и анимация"),
        (("фото", "изображ", "график", "дизайн"), "Графика, дизайн и фото"),
        (("электро", "схем", "радио", "ардуино", "arduino"), "Электроника и Arduino"),
        (("авиа", "судо", "ракето", "моделизм"), "Техническое моделирование"),
        (("математ", "олимпиад", "логик", "задач"), "Математика, логика и олимпиадные задачи"),
        (("исслед", "проект", "защита"), "Проектная и исследовательская работа"),
        (("диагност", "контроль", "тест", "итог"), "Диагностика и контроль"),
        (("безопас", "интернет", "сеть"), "Интернет и цифровая безопасность"),
        (("повтор", "заключ", "ввод"), "Вводные, повторение и итоговые занятия"),
    ]
    for needles, name in rules:
        if any(needle in term_text for needle in needles):
            return name
    return top_topic_items[0]["topic_name"][:80]


def write_topic_rows(topics: list[dict], labels: np.ndarray, summaries: list[dict]) -> None:
    summary_by_label = {summary["cluster_id"]: summary for summary in summaries}
    fields = [
        "cluster_number",
        "cluster_name",
        "topic_name",
        "normalized_topic",
        "topic_rows",
        "program_count",
        "hours_total",
    ]
    with TOPICS_PATH.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for topic, label in sorted(
            zip(topics, labels),
            key=lambda pair: (summary_by_label[int(pair[1])]["cluster_number"], -pair[0]["topic_rows"], pair[0]["topic_name"]),
        ):
            summary = summary_by_label[int(label)]
            writer.writerow(
                {
                    "cluster_number": summary["cluster_number"],
                    "cluster_name": summary["cluster_name"],
                    "topic_name": topic["topic_name"],
                    "normalized_topic": topic["normalized_topic"],
                    "topic_rows": topic["topic_rows"],
                    "program_count": topic["program_count"],
                    "hours_total": round(topic["hours_total"], 2),
                }
            )


def write_summary(summaries: list[dict]) -> None:
    fields = [
        "cluster_number",
        "cluster_name",
        "unique_topics",
        "topic_rows",
        "program_count",
        "hours_total",
        "top_terms",
        "examples",
    ]
    with SUMMARY_PATH.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for summary in summaries:
            writer.writerow({field: summary[field] for field in fields})


def write_report(summaries: list[dict]) -> None:
    lines = [
        "# Кластеры тем программ технической направленности",
        "",
        f"Источник: `{INPUT_PATH}`",
        f"Кластеров: {len(summaries)}",
        "",
        "| # | Кластер | Строк тем | Уникальных тем | Программ | Часы | Примеры тем |",
        "|---:|---|---:|---:|---:|---:|---|",
    ]
    for summary in summaries:
        examples = summary["examples"].replace("|", ";")
        lines.append(
            f"| {summary['cluster_number']} | {summary['cluster_name']} | {summary['topic_rows']} | "
            f"{summary['unique_topics']} | {summary['program_count']} | {summary['hours_total']} | {examples} |"
        )
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def topic_tokens(text: str) -> list[str]:
    words = [word for word in re.findall(r"[a-zа-я0-9]+", text.lower()) if len(word) >= 2]
    words = [word for word in words if word not in STOPWORDS]
    tokens = [f"word:{word}" for word in words]
    tokens.extend(f"bigram:{words[index]} {words[index + 1]}" for index in range(len(words) - 1))
    for word in words:
        if len(word) >= 4:
            for ngram_size in (3, 4, 5):
                tokens.extend(f"char:{word[index:index + ngram_size]}" for index in range(len(word) - ngram_size + 1))
    return tokens or ["word:прочее"]


def normalize_topic(value: str) -> str:
    text = str(value or "").lower().replace("ё", "е")
    text = re.sub(r"[\u00a0\t\r\n]+", " ", text)
    text = re.sub(r"[^0-9a-zа-я+#. -]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" .-")
    return text


def safe_float(value: str | None) -> float:
    try:
        return float(str(value or "0").replace(",", "."))
    except ValueError:
        return 0.0


if __name__ == "__main__":
    main()
