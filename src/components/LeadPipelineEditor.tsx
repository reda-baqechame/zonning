"use client";

import { CalendarClock, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, FieldLabel, Select } from "@/components/ui";
import type { PipelineStage } from "@/lib/domain/quebec";

export type { PipelineStage } from "@/lib/domain/quebec";

export function LeadPipelineEditor({
  id,
  stage,
  nextActionAt,
  note,
  saving,
  onStageChange,
  onDateChange,
  onNoteChange,
  onSave,
}: {
  id: string;
  stage: PipelineStage;
  nextActionAt: string;
  note: string;
  saving: boolean;
  onStageChange: (stage: PipelineStage) => void;
  onDateChange: (date: string) => void;
  onNoteChange: (note: string) => void;
  onSave: () => void;
}) {
  const t = useTranslations("feed.pipeline");
  const common = useTranslations("common");
  const stages: PipelineStage[] = [
    "new",
    "researching",
    "pursuing",
    "submitted",
    "won",
    "lost",
    "archived",
  ];

  return (
    <div className="mx-3 border-x border-b border-line bg-white px-4 pb-4 pt-3">
      <div className="grid gap-3 md:grid-cols-[minmax(10rem,0.7fr)_minmax(11rem,0.7fr)_minmax(16rem,1.6fr)_auto] md:items-end">
        <div>
          <FieldLabel htmlFor={`stage-${id}`}>{t("stage")}</FieldLabel>
          <Select
            id={`stage-${id}`}
            value={stage}
            onChange={(event) => onStageChange(event.target.value as PipelineStage)}
            className="mt-1"
          >
            {stages.map((value) => (
              <option key={value} value={value}>
                {t(`stages.${value}`)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor={`date-${id}`}>{t("nextAction")}</FieldLabel>
          <div className="relative mt-1">
            <CalendarClock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-subtle" />
            <input
              id={`date-${id}`}
              type="date"
              value={nextActionAt}
              onChange={(event) => onDateChange(event.target.value)}
              className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor={`note-${id}`}>{t("note")}</FieldLabel>
          <textarea
            id={`note-${id}`}
            value={note}
            maxLength={2000}
            rows={2}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={t("notePlaceholder")}
            className="mt-1 w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button size="sm" variant="secondary" disabled={saving} onClick={onSave}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {saving ? common("loading") : t("save")}
        </Button>
      </div>
    </div>
  );
}
