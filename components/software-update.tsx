"use client";

import { useSyncExternalStore } from "react";

const deployedAt = process.env.NEXT_PUBLIC_ALPHA_DEPLOYED_AT ?? null;
const description = process.env.NEXT_PUBLIC_ALPHA_DEPLOYMENT_DESCRIPTION
  ?? "Fix benchmark navigation and calculation fidelity";
const subscribe = () => () => undefined;

function localDeploymentTime() {
  if (!deployedAt) return "Deployment time unavailable";
  const timestamp = new Date(deployedAt);
  if (Number.isNaN(timestamp.getTime())) return "Deployment time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  }).format(timestamp);
}

export function SoftwareUpdate() {
  const localTime = useSyncExternalStore(subscribe, localDeploymentTime, () => "Reading local device time...");

  return <div className="alpha-surface p-5">
    <h2 className="font-medium">Last software update</h2>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
      <div>
        <dt className="alpha-kpi-label">Deployed</dt>
        <dd className="mt-1 text-sm"><time dateTime={deployedAt ?? undefined}>{localTime}</time></dd>
      </div>
      <div>
        <dt className="alpha-kpi-label">Description</dt>
        <dd className="mt-1 text-sm">{description}</dd>
      </div>
    </dl>
  </div>;
}
