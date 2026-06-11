# skills/

Набор скиллов (формат Codex/Claude `SKILL.md`).

**Эта папка не выкатывается на прод:**
- на сервере исключается через `sparse-checkout` (`deploy/remote-deploy.sh`);
- изменения только в `skills/**` не запускают деплой (`paths-ignore` в `.github/workflows/deploy.yml`).

То есть редактировать содержимое можно свободно — на работу бота и на прод это не влияет.
