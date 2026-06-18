"use client";

export default function ExportClient() {
  const download = (type: string) => {
    window.location.href = `/api/export?type=${type}`;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-white">Export CRM</h1>
      <p className="mt-3 text-slate-400">Téléchargez vos permis et appels d&apos;offres filtrés (Pro+).</p>
      <div className="mt-8 flex flex-col gap-4">
        <button
          type="button"
          onClick={() => download("permits")}
          className="rounded-xl border border-slate-700 px-6 py-4 text-left hover:border-sky-500"
        >
          <span className="font-semibold text-white">Permis CSV</span>
          <p className="text-sm text-slate-500">90 derniers jours + score RBQ-Fit</p>
        </button>
        <button
          type="button"
          onClick={() => download("tenders")}
          className="rounded-xl border border-slate-700 px-6 py-4 text-left hover:border-sky-500"
        >
          <span className="font-semibold text-white">Appels SEAO CSV</span>
          <p className="text-sm text-slate-500">Marchés ouverts</p>
        </button>
        <button
          type="button"
          onClick={() => (window.location.href = "/api/export?type=permits&eligibleOnly=true")}
          className="rounded-xl border border-slate-700 px-6 py-4 text-left hover:border-sky-500"
        >
          <span className="font-semibold text-white">Permis éligibles RBQ seulement</span>
        </button>
      </div>
    </div>
  );
}
