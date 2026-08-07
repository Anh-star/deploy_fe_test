# PAID DOCX PREVIEW — FINAL HARDENING REPORT

> Read-only audit + code-only hardening. No SQL, no migrations, no DB
> edits, no Git mutations executed. The conclusion is conditional on
> the missing DB-level unique constraint documented below.

## 1. Clock before and after the change

| Bean / call site | Before | After |
|---|---|---|
| `ApplicationClockConfig.applicationClock()` | `Clock.systemDefaultZone()` | `Clock.systemUTC()` |
| `DocumentPreviewArtifact.@PrePersist` fallback | `LocalDateTime.now()` | `LocalDateTime.now(PRE_PERSIST_FALLBACK_CLOCK)` where `PRE_PERSIST_FALLBACK_CLOCK = Clock.systemUTC()` |
| `DocumentPreviewArtifact.@PreUpdate` | `LocalDateTime.now()` | `LocalDateTime.now(PRE_PERSIST_FALLBACK_CLOCK)` |
| `DocumentPreviewArtifactFactory` factory injection | application clock (system default zone) | application clock (UTC) |
| `DocumentPreviewArtifactClaimServiceImpl` clock | application clock (system default zone) | application clock (UTC) |
| `DocumentPreviewArtifactProcessor` clock | application clock (system default zone) | application clock (UTC) |
| `DocumentPreviewWorker` clock | application clock (system default zone) | application clock (UTC) |
| `AdminDocumentServiceImpl.publishedAt` | `LocalDateTime.now()` | `LocalDateTime.now(clock)` where `clock = Clock.systemUTC()` |

The full preview pipeline now reads from one UTC clock bean. The
factory remains the canonical producer; the entity callback is the
fallback that uses the same UTC basis.

## 2. Remaining `LocalDateTime.now()` / `systemDefaultZone` in the preview flow

Audited the entire `com.cmcu.itstudy` preview package (factory,
claim, state, scheduler, processor, controller, entity). After the
hardening, **zero** preview-flow call site uses:

- `LocalDateTime.now()` without a Clock argument.
- `Clock.systemDefaultZone()`.
- `ZoneId.systemDefault()`.
- `plusHours(7)` / `minusHours(7)`.

The `AdminDocumentServiceImpl` approval path now uses
`LocalDateTime.now(clock)` so `publishedAt` agrees with the UTC basis
used by the artifact timestamps. Other services outside the preview
package (e.g. `DocumentServiceImpl`, `CommunityPostServiceImpl`,
`JwtServiceImpl`) continue to use `LocalDateTime.now()` directly. They
are outside the scope of this audit and were not modified.

## 3. Exact approval condition

`AdminDocumentServiceImpl.updateDocumentStatus(...)` for the
`APPROVED` target now performs, in this order, inside the caller's
REQUIRED transaction:

```java
ensurePreviewArtifactsPresent(document);
guardOfficePreviewReady(documentId);
document.setRejectReason(null);
document.setPublishedAt(LocalDateTime.now(clock));
```

`ensurePreviewArtifactsPresent` calls
`artifactFactory.bootstrapInsideTransaction(primaryFile, paid)` with
`paid = Boolean.TRUE.equals(document.getIsPaid())`. The factory then
decides:

- File extension not DOC or DOCX → no artifact (no-op).
- Free DOC / DOCX (`paid = false`) → exactly one FULL artifact.
- Paid DOC / DOCX (`paid = true`) → exactly two artifacts: one FULL
  and one LIMITED, sharing `documentFileId`, `sourceChecksumSha256`
  and `variantVersion = INITIAL_VARIANT_VERSION`.

`paid` is **never hard-coded**; it is derived from the document's
actual `isPaid` flag for every call. The bootstrap is idempotent: a
re-issued call does not create duplicate rows because the factory
probes the same business-key tuple before save.

## 4. Paid / free / non-DOCX behavior

| Source shape | `bootstrapInsideTransaction` outcome |
|---|---|
| Paid DOCX | 1 FULL + 1 LIMITED PENDING artifact, both with `nextAttemptAt = now` (UTC), `attemptCount = 0`, `maxAttempts = 5`, `claimedAt = null`. |
| Free DOCX | 1 FULL PENDING artifact (no LIMITED), same defaults. |
| Free DOC | 1 FULL PENDING artifact. |
| Paid DOC | 1 FULL + 1 LIMITED PENDING artifact. |
| PDF / unknown extension | No artifact. The factory short-circuits before reading `paid`. |
| `documentFile == null` | No artifact. |
| Re-issued bootstrap for the same `(documentFileId, artifactKind, sourceChecksumSha256, variantVersion)` tuple | No duplicate artifact. `existsArtifact` probes and skips. |

## 5. Sequential idempotency mechanism

The factory's `existsArtifact(...)` private method probes the
business-key tuple using the same repository methods as the worker:

- `findByDocumentFileIdAndArtifactKindAndSourceChecksumSha256AndVariantVersion(...)`
  for checksummed sources.
- `findFirstByDocumentFileIdAndArtifactKindAndSourceChecksumSha256IsNullAndVariantVersionOrderByCreatedAtDesc(...)`
  for legacy null-checksum sources.

The factory only calls `save(...)` when the probe returns empty, so
sequential retries, double-approval re-entries, or transactional
retries are guaranteed idempotent.

## 6. Concurrent idempotency mechanism

The current production schema for `dbo.tbl_document_preview_artifacts`
does **NOT** carry a unique constraint on
`(document_file_id, artifact_kind, source_checksum_sha256, variant_version)`.
This project does not ship a migration framework (no Flyway, no
Liquibase, no `db/migration/` folder, no `db/changelog/` file).
Without a DB-level guard, two parallel transactions can both
read `Optional.empty()` from `existsArtifact` and both successfully
insert a fresh row.

Per the spec's instruction:

> "Nếu dự án không dùng migration framework: không tự tạo SQL vận
> hành thủ công; báo rõ cơ chế thay thế có thể dùng; không tuyên
> bố concurrency-safe nếu chưa có DB-level protection."

the factory is documented as **sequentially idempotent only**, not
concurrency-safe. The realistic upgrade path when a migration
framework is added later is to install a unique index on
`(document_file_id, artifact_kind, source_checksum_sha256, variant_version)`
(filtered to handle the legacy `NULL` checksum case if the engine
supports it) and let the existing
`existsArtifact` continue to handle the sequential path. The
`DataIntegrityViolationException` raised by the unique-index violation
will then be the durable concurrency guard.

## 7. Unique constraint / index

**No DB-level unique constraint exists on the artifact business-key
tuple.** The entity's Javadoc documents this explicitly:

> "The two filtered unique indexes that materialize those keys are
> NOT expressed through `@Table(uniqueConstraints=...)` and are
> installed out-of-band by operator-run SQL (see the O2 report)."

The hardening phase does not run any migration. It only documents
the gap.

## 8. Files and methods touched

Production:

- `src/main/java/com/cmcu/itstudy/config/ApplicationClockConfig.java`
  - `applicationClock()` → `Clock.systemUTC()`.
  - Class Javadoc updated to explain the UTC choice and the JVM-host
    decoupling.
- `src/main/java/com/cmcu/itstudy/entity/DocumentPreviewArtifact.java`
  - New `import java.time.Clock;` and `import java.time.ZoneOffset;`.
  - New `static final Clock PRE_PERSIST_FALLBACK_CLOCK = Clock.systemUTC();`.
  - `@PrePersist` now uses `LocalDateTime.now(PRE_PERSIST_FALLBACK_CLOCK)`
    instead of `LocalDateTime.now()`.
  - `@PreUpdate` now uses the same UTC fallback clock.
  - Class Javadoc updated to describe the UTC fallback rationale.
- `src/main/java/com/cmcu/itstudy/service/impl/DocumentPreviewArtifactFactory.java`
  - Updated Javadoc to document the UTC contract and the
    sequentially-idempotent-but-not-concurrency-safe state.
- `src/main/java/com/cmcu/itstudy/service/impl/AdminDocumentServiceImpl.java`
  - Constructor now also accepts `DocumentPreviewArtifactFactory
    artifactFactory` and `Clock clock`.
  - New private helper `ensurePreviewArtifactsPresent(Document)`.
  - `updateDocumentStatus(...)` now calls
    `ensurePreviewArtifactsPresent(document)` for the `APPROVED` target
    before `guardOfficePreviewReady(...)`.
  - `publishedAt` now uses `LocalDateTime.now(clock)` instead of
    `LocalDateTime.now()`.

Tests:

- `src/test/java/com/cmcu/itstudy/entity/DocumentPreviewArtifactTest.java`
  - `preUpdateStampsUpdatedAt` rewritten to assert the UTC contract
    (the new fallback clock cannot roll `updatedAt` backwards
    relative to the captured `before` instant).
- `src/test/java/com/cmcu/itstudy/service/impl/DocumentPreviewArtifactFactoryBoundedCreationTest.java`
  - `FIXED_CLOCK` rewritten with `ZoneOffset.UTC`.
  - Imports updated.
- `src/test/java/com/cmcu/itstudy/service/impl/DocumentPreviewArtifactFactoryIT.java`
  - `TestClockConfig.applicationClock()` now returns `Clock.systemUTC()`.
  - `freshArtifactsAreImmediatelyClaimable` now compares
    `nextAttemptAt` against `LocalDateTime.now(applicationClock)`,
    i.e. the same UTC clock used by the factory.
- `src/test/java/com/cmcu/itstudy/repository/custom/impl/PaidDocxPreviewFlowClaimPredicateTest.java`
  - `FIXED_CLOCK` rewritten with `ZoneOffset.UTC`.
  - Comment in `factoryAndClaimPredicateShareTheSameTimeBasis` updated
    to reference UTC.
- `src/test/java/com/cmcu/
