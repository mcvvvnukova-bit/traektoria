# Query ontology and specific-interest ranking

Status: approved for implementation, 2026-06-17.

## Problem

The recommendation flow currently collapses concrete user interests into broad buckets such as `sports`, `logic`, or `creative`. A request like "занятия по баскетболу в Оленегорске для мальчика 13 лет" becomes a generic sports request, so broad sports programs can outrank basketball programs. The existing PFDO topic classifier already provides a program-side ontology through normalized topic names and level 1/2 classifier categories, but the user-query side does not preserve concrete terms.

## Design

Add a query ontology layer that maps user wording to:

- broad interests, for fallback recommendations;
- concrete `specificInterestTerms`, for exact ranking;
- direction metadata when the activity implies a direction.

The program-side ontology remains the current topic data:

- level 3: `normalized_topic_name` / `normalized_topic_key`;
- level 2: `category_name` / `category_code`;
- level 1: `parent_name` / `parent_code`;
- fallback: program name, keywords, annotation, and task text when topics are absent or incomplete.

The local LLM can help classify unknown terms, but production ranking must validate LLM output. A specific term is usable only when it is present in the original user text or is an ontology alias. The LLM must not invent related activities.

## Ranking Rules

When a request contains a concrete interest, exact matches are ordered before broad fallback matches:

1. Exact activity match, age fits, and open groups/free places are available.
2. Exact activity match and age fits, but groups/places are absent or enrollment is closed.
3. Exact activity match, but the age range does not fit.
4. Broadly related programs, such as other sports programs.

Within each bucket, the existing score still ranks by topic match, availability, direction, schedule, budget, and other criteria.

Age remains a hard filter for broad fallback programs. It is relaxed only for exact specific-interest matches so the bot can honestly show "this basketball program exists, but age does not fit" after better exact matches.

## Data Flow

1. `description-selection` parses free text and stores `specificInterestTerms` and `excludedSpecificInterestTerms` in scenario state.
2. `buildRecommendationProfile` forwards these fields to `recommendations`.
3. `recommendations` passes them into `scoreProgramCandidate`.
4. `scoring-model` matches specific terms against topic level 3, topic level 2, topic level 1, then fallback text.
5. `recommendations` applies the bucket sort before final slicing.

## Initial Scope

The first ontology is a curated code file with common activities already represented by existing regex rules: basketball, football, volleyball, hockey, swimming, gymnastics, martial arts, skiing, tennis, chess, robotics, programming, drawing, dance, vocal, theatre, and similar entries.

Unknown user terms may be carried as raw specific terms only when extracted conservatively from the user text. They do not permanently modify the ontology.

## Tests

Add focused tests for:

- parsing `баскетбол` into broad `sports` plus concrete basketball terms;
- not treating `не футбол` as a positive football interest;
- scoring a topic-level basketball match even when broad sports terms do not appear in classifier categories;
- allowing exact basketball age mismatches into a lower bucket;
- recommendation ordering: basketball with age and places, basketball without places, basketball age mismatch, then other sports.
