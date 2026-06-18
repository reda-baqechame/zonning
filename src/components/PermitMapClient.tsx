"use client";

import dynamic from "next/dynamic";
import type { PermitMapPoint } from "./PermitMap";

const PermitMapInner = dynamic(() => import("./PermitMap"), { ssr: false });

export default function PermitMapClient(props: { permits: PermitMapPoint[] }) {
  return <PermitMapInner {...props} />;
}
